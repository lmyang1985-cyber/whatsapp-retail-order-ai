import assert from "node:assert/strict";
import test from "node:test";
import { interpretMessage } from "./orderAi.js";
import { priceOrderItems } from "./pricing.js";
import { calculateCustomerBalance } from "./payments.js";
import { getDeliveryList, getPackingTotals } from "./summaries.js";

const businessId = "biz_1";

const customers = [
  {
    id: "cust_a",
    businessId,
    businessName: "Green Bowl Cafe",
    whatsappPhone: "+60123456789",
    contactPerson: "Aina",
    address: "12 Jalan Market, KL",
    area: "KL",
    customerType: "cafe",
    paymentTerms: "weekly",
    active: true,
  },
];

const products = [
  {
    id: "prod_young",
    businessId,
    name: "Young Coconut",
    aliases: ["young coconuts", "kelapa muda", "椰青", "young"],
    unit: "piece",
    defaultPrice: 3.2,
    active: true,
  },
  {
    id: "prod_old",
    businessId,
    name: "Old Coconut",
    aliases: ["old coconuts", "kelapa tua", "old"],
    unit: "piece",
    defaultPrice: 2.4,
    active: true,
  },
];

test("interprets a clear multilingual WhatsApp order and confirms without exposing price", () => {
  const result = interpretMessage({
    businessId,
    fromPhone: "+60 12-345 6789",
    text: "Esok hantar 80 kelapa muda ya",
    receivedAt: new Date("2026-05-24T10:00:00+08:00"),
    customers,
    products,
  });

  assert.equal(result.status, "confirmed");
  assert.equal(result.customer?.id, "cust_a");
  assert.equal(result.orderDraft?.deliveryDate, "2026-05-25");
  assert.deepEqual(result.orderDraft?.items, [
    {
      productId: "prod_young",
      productName: "Young Coconut",
      quantity: 80,
      unit: "piece",
    },
  ]);
  assert.match(result.replyText ?? "", /80 Young Coconut/);
  assert.doesNotMatch(result.replyText ?? "", /\$|RM|3\.2|256/);
});

test("sends risky or ambiguous messages to review with reasons", () => {
  const result = interpretMessage({
    businessId,
    fromPhone: "+60123456789",
    text: "Can give cheaper price for many coconut today?",
    receivedAt: new Date("2026-05-24T10:00:00+08:00"),
    customers,
    products,
  });

  assert.equal(result.status, "needs_review");
  assert.ok(result.reviewReasons.includes("price_or_payment_discussion"));
});

test("asks one short clarification question when quantity is missing", () => {
  const result = interpretMessage({
    businessId,
    fromPhone: "+60123456789",
    text: "Tomorrow young coconut",
    receivedAt: new Date("2026-05-24T10:00:00+08:00"),
    customers,
    products,
  });

  assert.equal(result.status, "clarification");
  assert.equal(result.replyText, "How many Young Coconut would you like?");
});

test("uses customer special price before default price", () => {
  const prices = [
    {
      id: "price_1",
      customerId: "cust_a",
      productId: "prod_young",
      price: 2.85,
      active: true,
    },
  ];

  const priced = priceOrderItems(
    [{ productId: "prod_young", quantity: 80 }],
    "cust_a",
    products,
    prices,
  );

  assert.equal(priced[0].unitPrice, 2.85);
  assert.equal(priced[0].lineTotal, 228);
  assert.equal(priced[0].manualPriceOverride, false);
});

test("builds packing totals and customer delivery list for a selected date", () => {
  const orders = [
    {
      id: "ord_1",
      businessId,
      customerId: "cust_a",
      source: "whatsapp",
      deliveryDate: "2026-05-25",
      orderStatus: "confirmed",
      paymentStatus: "unpaid",
      amountPaid: 0,
      totalAmount: 228,
      notes: "Back entrance",
      createdAt: "2026-05-24T10:05:00+08:00",
      updatedAt: "2026-05-24T10:05:00+08:00",
      items: [
        {
          id: "item_1",
          orderId: "ord_1",
          productId: "prod_young",
          quantity: 80,
          unit: "piece",
          unitPrice: 2.85,
          manualPriceOverride: false,
        },
      ],
    },
  ];

  assert.deepEqual(getPackingTotals(orders, products, "2026-05-25"), [
    {
      productId: "prod_young",
      productName: "Young Coconut",
      quantity: 80,
      unit: "piece",
    },
  ]);

  assert.deepEqual(getDeliveryList(orders, customers, products, "2026-05-25"), [
    {
      orderId: "ord_1",
      customerName: "Green Bowl Cafe",
      address: "12 Jalan Market, KL",
      phone: "+60123456789",
      area: "KL",
      notes: "Back entrance",
      paymentStatus: "unpaid",
      amountToCollect: 228,
      items: "80 piece Young Coconut",
    },
  ]);
});

test("calculates outstanding customer balance from orders and payments", () => {
  const orders = [
    {
      id: "ord_1",
      businessId,
      customerId: "cust_a",
      source: "whatsapp",
      deliveryDate: "2026-05-25",
      orderStatus: "delivered",
      paymentStatus: "partial",
      amountPaid: 100,
      totalAmount: 228,
      notes: "",
      createdAt: "2026-05-24T10:05:00+08:00",
      updatedAt: "2026-05-24T10:05:00+08:00",
      items: [],
    },
  ];
  const payments = [
    {
      id: "pay_1",
      businessId,
      customerId: "cust_a",
      orderId: "ord_1",
      amount: 100,
      method: "cash",
      paymentDate: "2026-05-25",
      notes: "",
    },
  ];

  assert.equal(calculateCustomerBalance("cust_a", orders, payments), 128);
});
