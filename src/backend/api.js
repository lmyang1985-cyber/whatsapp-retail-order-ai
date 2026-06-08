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

  if (method === "POST" && pathname === "/api/orders") {
    return createManualOrder(database, body);
  }

  const orderMatch = pathname.match(/^\/api\/orders\/([^/]+)$/);
  if (method === "PATCH" && orderMatch) {
    return updateOrder(database, orderMatch[1], body);
  }

  const orderCancelMatch = pathname.match(/^\/api\/orders\/([^/]+)\/cancel$/);
  if (method === "POST" && orderCancelMatch) {
    return setOrderLifecycleStatus(database, orderCancelMatch[1], "cancelled", body?.reason);
  }

  const orderDeliveredMatch = pathname.match(/^\/api\/orders\/([^/]+)\/delivered$/);
  if (method === "POST" && orderDeliveredMatch) {
    return setOrderLifecycleStatus(database, orderDeliveredMatch[1], "delivered");
  }

  if (method === "GET" && pathname === "/api/customers") {
    const data = database.snapshot();
    return json(200, { customers: data.customers });
  }

  if (method === "POST" && pathname === "/api/customers") {
    return createCustomer(database, body);
  }

  const customerMatch = pathname.match(/^\/api\/customers\/([^/]+)$/);
  if (customerMatch && method === "PATCH") {
    return updateCustomer(database, customerMatch[1], body);
  }

  if (customerMatch && method === "DELETE") {
    return deactivateCustomer(database, customerMatch[1]);
  }

  if (method === "GET" && pathname === "/api/products") {
    const data = database.snapshot();
    return json(200, { products: data.products });
  }

  if (method === "POST" && pathname === "/api/products") {
    return createProduct(database, body);
  }

  const productMatch = pathname.match(/^\/api\/products\/([^/]+)$/);
  if (productMatch && method === "PATCH") {
    return updateProduct(database, productMatch[1], body);
  }

  if (productMatch && method === "DELETE") {
    return deactivateProduct(database, productMatch[1]);
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
  const pricedItems = priceItemsForCustomer(data, customer.id, draft.items);
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

function createManualOrder(database, body) {
  if (!body?.customerId || !body?.deliveryDate || !Array.isArray(body.items) || body.items.length === 0) {
    return json(400, { error: "customer_delivery_date_and_items_required" });
  }

  let created;
  database.update((data) => {
    const customer = data.customers.find((candidate) => candidate.id === body.customerId && candidate.active);
    if (!customer) return data;
    created = createOrder(
      data,
      data.businesses[0].id,
      customer,
      { deliveryDate: body.deliveryDate, items: body.items },
      "manual",
    );
    created.notes = body.notes ?? "";
    data.orders.unshift(created);
    return data;
  });

  return created ? json(201, { order: created }) : json(404, { error: "customer_not_found" });
}

function updateOrder(database, orderId, body) {
  let updated;
  database.update((data) => {
    data.orders = data.orders.map((order) => {
      if (order.id !== orderId) return order;
      const items = Array.isArray(body.items)
        ? buildOrderItems(data, order.id, order.customerId, body.items)
        : order.items;
      updated = {
        ...order,
        deliveryDate: body.deliveryDate ?? order.deliveryDate,
        orderStatus: body.orderStatus ?? order.orderStatus,
        paymentStatus: body.paymentStatus ?? order.paymentStatus,
        notes: body.notes ?? order.notes,
        items,
        totalAmount: roundMoney(items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0)),
        updatedAt: new Date().toISOString(),
      };
      return updated;
    });
    return data;
  });

  return updated ? json(200, { order: updated }) : json(404, { error: "order_not_found" });
}

function setOrderLifecycleStatus(database, orderId, orderStatus, reason = "") {
  let updated;
  database.update((data) => {
    data.orders = data.orders.map((order) => {
      if (order.id !== orderId) return order;
      const notes = reason ? `${order.notes ? `${order.notes}\n` : ""}Cancelled: ${reason}` : order.notes;
      updated = {
        ...order,
        orderStatus,
        notes,
        updatedAt: new Date().toISOString(),
      };
      return updated;
    });
    return data;
  });
  return updated ? json(200, { order: updated }) : json(404, { error: "order_not_found" });
}

function createCustomer(database, body) {
  if (!body?.businessName || !body?.whatsappPhone) {
    return json(400, { error: "business_name_and_whatsapp_phone_required" });
  }
  let customer;
  database.update((data) => {
    customer = {
      id: `cust_${randomUUID()}`,
      businessId: data.businesses[0].id,
      businessName: body.businessName,
      whatsappPhone: body.whatsappPhone,
      contactPerson: body.contactPerson ?? "",
      address: body.address ?? "",
      area: body.area ?? "",
      customerType: body.customerType ?? "other",
      paymentTerms: body.paymentTerms ?? "per order",
      active: true,
    };
    data.customers.push(customer);
    return data;
  });
  return json(201, { customer });
}

function updateCustomer(database, customerId, body) {
  let updated;
  database.update((data) => {
    data.customers = data.customers.map((customer) => {
      if (customer.id !== customerId) return customer;
      updated = {
        ...customer,
        ...pick(body, [
          "businessName",
          "whatsappPhone",
          "contactPerson",
          "address",
          "area",
          "customerType",
          "paymentTerms",
          "active",
        ]),
      };
      return updated;
    });
    return data;
  });
  return updated ? json(200, { customer: updated }) : json(404, { error: "customer_not_found" });
}

function deactivateCustomer(database, customerId) {
  return updateCustomer(database, customerId, { active: false });
}

function createProduct(database, body) {
  if (!body?.name) return json(400, { error: "name_required" });
  let product;
  database.update((data) => {
    product = {
      id: `prod_${randomUUID()}`,
      businessId: data.businesses[0].id,
      name: body.name,
      aliases: body.aliases ?? [],
      unit: body.unit ?? "custom",
      defaultPrice: Number(body.defaultPrice ?? 0),
      active: true,
    };
    data.products.push(product);
    return data;
  });
  return json(201, { product });
}

function updateProduct(database, productId, body) {
  let updated;
  database.update((data) => {
    data.products = data.products.map((product) => {
      if (product.id !== productId) return product;
      updated = {
        ...product,
        ...pick(body, ["name", "aliases", "unit", "active"]),
        defaultPrice: body.defaultPrice === undefined ? product.defaultPrice : Number(body.defaultPrice),
      };
      return updated;
    });
    return data;
  });
  return updated ? json(200, { product: updated }) : json(404, { error: "product_not_found" });
}

function deactivateProduct(database, productId) {
  return updateProduct(database, productId, { active: false });
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

function buildOrderItems(data, orderId, customerId, items) {
  return priceItemsForCustomer(data, customerId, items).map((item, index) => ({
    id: `${orderId}_item_${index + 1}`,
    orderId,
    ...item,
  }));
}

function priceItemsForCustomer(data, customerId, items) {
  return priceOrderItems(
    items.map((item) => ({
      productId: item.productId,
      quantity: Number(item.quantity),
      unitPrice: item.unitPrice,
      manualPriceOverride: item.manualPriceOverride,
    })),
    customerId,
    data.products,
    data.customerSpecialPrices,
  );
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

function pick(source = {}, keys) {
  return Object.fromEntries(keys.filter((key) => source[key] !== undefined).map((key) => [key, source[key]]));
}
