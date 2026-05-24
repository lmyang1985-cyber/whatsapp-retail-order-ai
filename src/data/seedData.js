import { priceOrderItems } from "../domain/pricing.js";

export const business = {
  id: "biz_1",
  name: "Palm & Pantry Supply",
  whatsappAccount: "WhatsApp Cloud API ready",
  active: true,
};

export const users = [
  {
    id: "user_1",
    businessId: business.id,
    name: "Office Desk",
    login: "office@palm-pantry.local",
    role: "admin",
    active: true,
  },
];

export const customers = [
  {
    id: "cust_green_bowl",
    businessId: business.id,
    businessName: "Green Bowl Cafe",
    whatsappPhone: "+60123456789",
    contactPerson: "Aina",
    address: "12 Jalan Market, Kuala Lumpur",
    area: "KL Central",
    customerType: "cafe",
    paymentTerms: "weekly",
    active: true,
  },
  {
    id: "cust_morning_market",
    businessId: business.id,
    businessName: "Morning Market Stall 18",
    whatsappPhone: "+60198887777",
    contactPerson: "Mr Lim",
    address: "Stall 18, Pasar Besar Selayang",
    area: "Selayang",
    customerType: "market",
    paymentTerms: "per order",
    active: true,
  },
  {
    id: "cust_lotus",
    businessId: business.id,
    businessName: "Lotus Garden Restaurant",
    whatsappPhone: "+60162223333",
    contactPerson: "Wei Ling",
    address: "88 Jalan Sultan, Petaling Jaya",
    area: "PJ",
    customerType: "restaurant",
    paymentTerms: "monthly",
    active: true,
  },
];

export const products = [
  {
    id: "prod_young",
    businessId: business.id,
    name: "Young Coconut",
    aliases: ["young coconut", "young coconuts", "kelapa muda", "椰青", "young"],
    unit: "piece",
    defaultPrice: 3.2,
    active: true,
  },
  {
    id: "prod_old",
    businessId: business.id,
    name: "Old Coconut",
    aliases: ["old coconut", "old coconuts", "kelapa tua", "old"],
    unit: "piece",
    defaultPrice: 2.4,
    active: true,
  },
  {
    id: "prod_water",
    businessId: business.id,
    name: "Coconut Water Bottle",
    aliases: ["bottle", "coconut water", "air kelapa", "椰水"],
    unit: "bottle",
    defaultPrice: 5.5,
    active: true,
  },
];

export const specialPrices = [
  {
    id: "price_green_young",
    customerId: "cust_green_bowl",
    productId: "prod_young",
    price: 2.85,
    active: true,
  },
  {
    id: "price_lotus_water",
    customerId: "cust_lotus",
    productId: "prod_water",
    price: 4.95,
    active: true,
  },
];

export const initialMessages = [
  {
    id: "msg_1",
    businessId: business.id,
    customerId: "cust_green_bowl",
    whatsappMessageId: "wamid.1001",
    direction: "inbound",
    text: "Esok hantar 80 kelapa muda ya",
    detectedLanguage: "Malay",
    aiConfidence: 0.91,
    linkedOrderId: "ord_1",
    createdAt: "2026-05-24T10:04:00+08:00",
    status: "auto_confirmed",
    reviewReasons: [],
    aiSummary: "80 Young Coconut for 2026-05-25",
    replyText: "Confirmed: 80 Young Coconut for delivery 2026-05-25. Reply CHANGE if wrong.",
  },
  {
    id: "msg_2",
    businessId: business.id,
    customerId: "cust_lotus",
    whatsappMessageId: "wamid.1002",
    direction: "inbound",
    text: "明天 40 椰水 bottle",
    detectedLanguage: "Mixed",
    aiConfidence: 0.88,
    linkedOrderId: "ord_2",
    createdAt: "2026-05-24T10:10:00+08:00",
    status: "auto_confirmed",
    reviewReasons: [],
    aiSummary: "40 Coconut Water Bottle for 2026-05-25",
    replyText: "Confirmed: 40 Coconut Water Bottle for delivery 2026-05-25. Reply CHANGE if wrong.",
  },
  {
    id: "msg_3",
    businessId: business.id,
    customerId: "cust_morning_market",
    whatsappMessageId: "wamid.1003",
    direction: "inbound",
    text: "Tomorrow young coconut",
    detectedLanguage: "English",
    aiConfidence: 0.68,
    linkedOrderId: null,
    createdAt: "2026-05-24T10:14:00+08:00",
    status: "clarification",
    reviewReasons: ["missing_quantity"],
    aiSummary: "Product detected, quantity missing",
    replyText: "How many Young Coconut would you like?",
  },
  {
    id: "msg_4",
    businessId: business.id,
    customerId: null,
    whatsappMessageId: "wamid.1004",
    direction: "inbound",
    text: "Can cheaper price for many coconut today?",
    detectedLanguage: "English",
    aiConfidence: 0.42,
    linkedOrderId: null,
    createdAt: "2026-05-24T10:18:00+08:00",
    status: "needs_review",
    reviewReasons: ["unknown_customer", "price_or_payment_discussion"],
    aiSummary: "Price discussion or unknown customer",
    replyText: "",
  },
];

const orderOneItems = priceOrderItems(
  [{ productId: "prod_young", quantity: 80 }],
  "cust_green_bowl",
  products,
  specialPrices,
);

const orderTwoItems = priceOrderItems(
  [{ productId: "prod_water", quantity: 40 }],
  "cust_lotus",
  products,
  specialPrices,
);

const orderThreeItems = priceOrderItems(
  [{ productId: "prod_old", quantity: 120 }],
  "cust_morning_market",
  products,
  specialPrices,
);

export const initialOrders = [
  {
    id: "ord_1",
    businessId: business.id,
    customerId: "cust_green_bowl",
    source: "whatsapp",
    deliveryDate: "2026-05-25",
    orderStatus: "confirmed",
    paymentStatus: "credit",
    amountPaid: 0,
    totalAmount: orderOneItems.reduce((sum, item) => sum + item.lineTotal, 0),
    notes: "Use rear service door before 11am.",
    createdAt: "2026-05-24T10:05:00+08:00",
    updatedAt: "2026-05-24T10:05:00+08:00",
    items: orderOneItems.map((item, index) => ({
      id: `ord_1_item_${index + 1}`,
      orderId: "ord_1",
      ...item,
    })),
  },
  {
    id: "ord_2",
    businessId: business.id,
    customerId: "cust_lotus",
    source: "whatsapp",
    deliveryDate: "2026-05-25",
    orderStatus: "confirmed",
    paymentStatus: "credit",
    amountPaid: 0,
    totalAmount: orderTwoItems.reduce((sum, item) => sum + item.lineTotal, 0),
    notes: "Call Wei Ling on arrival.",
    createdAt: "2026-05-24T10:11:00+08:00",
    updatedAt: "2026-05-24T10:11:00+08:00",
    items: orderTwoItems.map((item, index) => ({
      id: `ord_2_item_${index + 1}`,
      orderId: "ord_2",
      ...item,
    })),
  },
  {
    id: "ord_3",
    businessId: business.id,
    customerId: "cust_morning_market",
    source: "manual",
    deliveryDate: "2026-05-25",
    orderStatus: "delivered",
    paymentStatus: "partial",
    amountPaid: 150,
    totalAmount: orderThreeItems.reduce((sum, item) => sum + item.lineTotal, 0),
    notes: "Collect balance from stall cashier.",
    createdAt: "2026-05-24T09:30:00+08:00",
    updatedAt: "2026-05-24T15:30:00+08:00",
    items: orderThreeItems.map((item, index) => ({
      id: `ord_3_item_${index + 1}`,
      orderId: "ord_3",
      ...item,
    })),
  },
];

export const initialPayments = [
  {
    id: "pay_1",
    businessId: business.id,
    customerId: "cust_morning_market",
    orderId: "ord_3",
    amount: 150,
    method: "cash",
    paymentDate: "2026-05-24",
    notes: "Partial cash collection",
  },
];
