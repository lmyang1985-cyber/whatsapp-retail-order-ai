import { randomUUID } from "node:crypto";
import { interpretMessage } from "../domain/orderAi.js";
import { calculateCustomerBalance } from "../domain/payments.js";
import { priceOrderItems, roundMoney } from "../domain/pricing.js";
import { getDeliveryList, getPackingTotals } from "../domain/summaries.js";

export function createApi({ database }) {
  return {
    async handle(request) {
      try {
        return routeRequest(database, request);
      } catch (error) {
        return json(500, { error: "internal_error", message: error.message });
      }
    },
  };
}

function routeRequest(database, request) {
  const { method, pathname, query, body } = request;

  if (method === "GET" && pathname === "/api/bootstrap") {
    const data = database.snapshot();
    return json(200, {
      business: data.businesses[0],
      users: data.users,
      customers: data.customers,
      products: data.products,
      specialPrices: data.customerSpecialPrices,
      messages: data.messages,
      orders: data.orders,
      payments: data.payments,
      balances: customerBalances(data),
    });
  }

  if (method === "GET" && pathname === "/api/orders") {
    const data = database.snapshot();
    const date = query.get("date");
    const status = query.get("status");
    const orders = data.orders.filter((order) => {
      const dateMatches = !date || order.deliveryDate === date;
      const statusMatches = !status || status === "all" || order.orderStatus === status;
      return dateMatches && statusMatches;
    });
    return json(200, { orders });
  }

  if (method === "GET" && pathname === "/api/daily-summary") {
    const data = database.snapshot();
    const date = query.get("date") ?? todayKey();
    return json(200, {
      date,
      packingTotals: getPackingTotals(data.orders, data.products, date),
      deliveryList: getDeliveryList(data.orders, data.customers, data.products, date),
    });
  }

  if (method === "POST" && pathname === "/api/whatsapp/webhook") {
    return receiveWebhook(database, body);
  }

  const reviewedMatch = pathname.match(/^\/api\/messages\/([^/]+)\/reviewed$/);
  if (method === "POST" && reviewedMatch) {
    return markMessageReviewed(database, reviewedMatch[1]);
  }

  const paymentMatch = pathname.match(/^\/api\/orders\/([^/]+)\/payment$/);
  if (method === "PATCH" && paymentMatch) {
    return updateOrderPayment(database, paymentMatch[1], body);
  }

  return json(404, { error: "not_found" });
}

function receiveWebhook(database, body) {
  if (!body?.fromPhone || !body?.text) {
    return json(400, { error: "fromPhone_and_text_required" });
  }

  let responseBody;
  database.update((data) => {
    const business = data.businesses[0];
    const result = interpretMessage({
      businessId: business.id,
      fromPhone: body.fromPhone,
      text: body.text,
      receivedAt: new Date(body.receivedAt ?? Date.now()),
      customers: data.customers,
      products: data.products,
    });

    let linkedOrderId = null;
    if (result.status === "confirmed" && result.customer && result.orderDraft) {
      const order = createOrder(data, business.id, result.customer, result.orderDraft, "whatsapp");
      data.orders.unshift(order);
      linkedOrderId = order.id;
    }

    const message = {
      id: body.messageId ?? `msg_${randomUUID()}`,
      businessId: business.id,
      customerId: result.customer?.id ?? null,
      whatsappMessageId: body.whatsappMessageId ?? `local.${randomUUID()}`,
      direction: "inbound",
      text: body.text,
      detectedLanguage: result.detectedLanguage,
      aiConfidence: result.confidence,
      linkedOrderId,
      createdAt: new Date().toISOString(),
      status: result.status === "confirmed" ? "auto_confirmed" : result.status,
      reviewReasons: result.reviewReasons,
      aiSummary: result.orderDraft
        ? result.orderDraft.items.map((item) => `${item.quantity} ${item.productName}`).join(", ")
        : result.reviewReasons.join(", "),
      replyText: result.replyText ?? "",
    };
    data.messages.unshift(message);
    responseBody = {
      message,
      linkedOrderId,
      outboundReply: result.replyText ?? "Needs staff review before reply.",
    };
    return data;
  });

  return json(201, responseBody);
}

function createOrder(data, businessId, customer, draft, source) {
  const orderId = `ord_${randomUUID()}`;
  const pricedItems = priceOrderItems(
    draft.items.map((item) => ({ productId: item.productId, quantity: item.quantity })),
    customer.id,
    data.products,
    data.customerSpecialPrices,
  );
  const now = new Date().toISOString();
  return {
    id: orderId,
    businessId,
    customerId: customer.id,
    source,
    deliveryDate: draft.deliveryDate,
    orderStatus: "confirmed",
    paymentStatus: customer.paymentTerms === "per order" ? "unpaid" : "credit",
    amountPaid: 0,
    totalAmount: roundMoney(pricedItems.reduce((sum, item) => sum + item.lineTotal, 0)),
    notes: "",
    createdAt: now,
    updatedAt: now,
    items: pricedItems.map((item, index) => ({
      id: `${orderId}_item_${index + 1}`,
      orderId,
      ...item,
    })),
  };
}

function markMessageReviewed(database, messageId) {
  let updated;
  database.update((data) => {
    data.messages = data.messages.map((message) => {
      if (message.id !== messageId) return message;
      updated = {
        ...message,
        status: "reviewed",
        aiConfidence: Math.max(message.aiConfidence ?? 0, 0.75),
      };
      return updated;
    });
    return data;
  });
  return updated ? json(200, { message: updated }) : json(404, { error: "message_not_found" });
}

function updateOrderPayment(database, orderId, body) {
  const amountPaid = Number(body?.amountPaid ?? 0);
  let updatedOrder;
  let payment;

  database.update((data) => {
    data.orders = data.orders.map((order) => {
      if (order.id !== orderId) return order;
      updatedOrder = {
        ...order,
        paymentStatus: body.paymentStatus ?? order.paymentStatus,
        amountPaid,
        updatedAt: new Date().toISOString(),
      };
      return updatedOrder;
    });

    if (updatedOrder && amountPaid > 0) {
      payment = {
        id: `pay_${randomUUID()}`,
        businessId: updatedOrder.businessId,
        customerId: updatedOrder.customerId,
        orderId: updatedOrder.id,
        amount: amountPaid,
        method: body.method ?? "other",
        paymentDate: body.paymentDate ?? todayKey(),
        notes: body.notes ?? "",
      };
      data.payments.push(payment);
    }
    return data;
  });

  return updatedOrder ? json(200, { order: updatedOrder, payment }) : json(404, { error: "order_not_found" });
}

function customerBalances(data) {
  return data.customers.map((customer) => ({
    customerId: customer.id,
    balance: calculateCustomerBalance(customer.id, data.orders, data.payments),
  }));
}

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function json(status, body) {
  return { status, body };
}
