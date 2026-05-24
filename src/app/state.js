import { interpretMessage } from "../domain/orderAi.js";
import { calculateCustomerBalance } from "../domain/payments.js";
import { priceOrderItems } from "../domain/pricing.js";
import { getDeliveryList, getPackingTotals } from "../domain/summaries.js";
import {
  business,
  customers,
  initialMessages,
  initialOrders,
  initialPayments,
  products,
  specialPrices,
} from "../data/seedData.js";

export function createInitialState() {
  return {
    business,
    customers,
    products,
    specialPrices,
    messages: structuredClone(initialMessages),
    orders: structuredClone(initialOrders),
    payments: structuredClone(initialPayments),
    selectedDate: "2026-05-25",
    selectedMessageId: "msg_3",
    selectedOrderId: "ord_1",
    orderStatusFilter: "all",
    activeSection: "Inbox",
    composerPhone: "+60198887777",
    composerText: "Tomorrow 65 old coconuts",
    lastOutbound: "",
  };
}

export function deriveState(state) {
  const filteredOrders = state.orders.filter((order) => {
    const sameDate = order.deliveryDate === state.selectedDate;
    const sameStatus =
      state.orderStatusFilter === "all" || order.orderStatus === state.orderStatusFilter;
    return sameDate && sameStatus;
  });
  const selectedMessage =
    state.messages.find((message) => message.id === state.selectedMessageId) ?? state.messages[0];
  const selectedOrder =
    state.orders.find((order) => order.id === state.selectedOrderId) ?? state.orders[0];
  const packingTotals = getPackingTotals(state.orders, state.products, state.selectedDate);
  const deliveryList = getDeliveryList(state.orders, state.customers, state.products, state.selectedDate);
  const balances = state.customers.map((customer) => ({
    customer,
    balance: calculateCustomerBalance(customer.id, state.orders, state.payments),
  }));
  const needsReviewCount = state.messages.filter((message) => message.status === "needs_review").length;
  const unpaidAmount = balances.reduce((sum, row) => sum + Math.max(0, row.balance), 0);

  return {
    filteredOrders,
    selectedMessage,
    selectedOrder,
    packingTotals,
    deliveryList,
    balances,
    needsReviewCount,
    unpaidAmount,
  };
}

export function createOrderFromDraft(state, customer, draft, source = "whatsapp") {
  const pricedItems = priceOrderItems(
    draft.items.map((item) => ({ productId: item.productId, quantity: item.quantity })),
    customer.id,
    state.products,
    state.specialPrices,
  );
  const orderId = `ord_${Date.now()}`;
  const now = new Date().toISOString();
  const items = pricedItems.map((item, index) => ({
    id: `${orderId}_item_${index + 1}`,
    orderId,
    ...item,
  }));
  return {
    id: orderId,
    businessId: state.business.id,
    customerId: customer.id,
    source,
    deliveryDate: draft.deliveryDate,
    orderStatus: "confirmed",
    paymentStatus: customer.paymentTerms === "per order" ? "unpaid" : "credit",
    amountPaid: 0,
    totalAmount: pricedItems.reduce((sum, item) => sum + item.lineTotal, 0),
    notes: "",
    createdAt: now,
    updatedAt: now,
    items,
  };
}

export function receiveComposerMessage(state) {
  const result = interpretMessage({
    businessId: state.business.id,
    fromPhone: state.composerPhone,
    text: state.composerText,
    receivedAt: new Date("2026-05-24T10:00:00+08:00"),
    customers: state.customers,
    products: state.products,
  });
  const id = `msg_${Date.now()}`;
  let linkedOrderId = null;
  const nextOrders = [...state.orders];
  if (result.status === "confirmed" && result.customer && result.orderDraft) {
    const order = createOrderFromDraft(state, result.customer, result.orderDraft);
    nextOrders.unshift(order);
    linkedOrderId = order.id;
  }

  const message = {
    id,
    businessId: state.business.id,
    customerId: result.customer?.id ?? null,
    whatsappMessageId: `local.${Date.now()}`,
    direction: "inbound",
    text: state.composerText,
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

  return {
    ...state,
    messages: [message, ...state.messages],
    orders: nextOrders,
    selectedMessageId: id,
    selectedOrderId: linkedOrderId ?? state.selectedOrderId,
    lastOutbound: result.replyText ?? "Sent to Needs Review for staff handling.",
  };
}
