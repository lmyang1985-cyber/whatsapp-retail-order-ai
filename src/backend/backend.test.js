import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { createApi } from "./api.js";
import { createSeedDatabase } from "./createSeedDatabase.js";
import { JsonDatabase } from "./jsonDatabase.js";

test("database schema defines all core multi-business tables", async () => {
  const schema = await readFile(new URL("../../db/schema.sql", import.meta.url), "utf8");
  for (const table of [
    "businesses",
    "users",
    "customers",
    "products",
    "customer_special_prices",
    "orders",
    "order_items",
    "messages",
    "payments",
  ]) {
    assert.match(schema, new RegExp(`create table ${table}`, "i"));
  }
  assert.match(schema, /business_id/i);
  assert.match(schema, /order_status/i);
  assert.match(schema, /payment_status/i);
  assert.match(schema, /idx_orders_business_delivery_date/i);
});

test("seed database loads business, customers, products, orders, messages, and payments", () => {
  const database = createSeedDatabase();
  const snapshot = database.snapshot();

  assert.equal(snapshot.businesses.length, 1);
  assert.equal(snapshot.customers.length, 3);
  assert.equal(snapshot.products.length, 3);
  assert.ok(snapshot.orders.length >= 3);
  assert.ok(snapshot.messages.length >= 4);
  assert.equal(snapshot.payments.length, 1);
});

test("api bootstrap returns dashboard data without exposing internal price in whatsapp replies", async () => {
  const api = createApi({ database: createSeedDatabase() });
  const response = await api.handle({
    method: "GET",
    pathname: "/api/bootstrap",
    query: new URLSearchParams(),
    body: null,
  });

  assert.equal(response.status, 200);
  assert.equal(response.body.business.name, "Palm & Pantry Supply");
  assert.equal(response.body.customers.length, 3);
  assert.ok(response.body.messages[0].replyText);
  assert.doesNotMatch(response.body.messages[0].replyText, /RM|2\.85|228/);
});

test("daily summary endpoint returns packing totals and delivery list for selected date", async () => {
  const api = createApi({ database: createSeedDatabase() });
  const response = await api.handle({
    method: "GET",
    pathname: "/api/daily-summary",
    query: new URLSearchParams([["date", "2026-05-25"]]),
    body: null,
  });

  assert.equal(response.status, 200);
  assert.ok(response.body.packingTotals.some((row) => row.productName === "Young Coconut"));
  assert.ok(response.body.deliveryList.some((row) => row.customerName === "Green Bowl Cafe"));
});

test("whatsapp webhook creates a confirmed order for clear messages", async () => {
  const database = createSeedDatabase();
  const api = createApi({ database });
  const before = database.snapshot().orders.length;
  const response = await api.handle({
    method: "POST",
    pathname: "/api/whatsapp/webhook",
    query: new URLSearchParams(),
    body: {
      fromPhone: "+60198887777",
      text: "Tomorrow 65 old coconuts",
      receivedAt: "2026-05-24T10:00:00+08:00",
    },
  });

  assert.equal(response.status, 201);
  assert.equal(response.body.message.status, "auto_confirmed");
  assert.match(response.body.outboundReply, /65 Old Coconut/);
  assert.doesNotMatch(response.body.outboundReply, /RM|156/);
  assert.equal(database.snapshot().orders.length, before + 1);
});

test("review and payment endpoints update records", async () => {
  const database = createSeedDatabase();
  const api = createApi({ database });

  const review = await api.handle({
    method: "POST",
    pathname: "/api/messages/msg_4/reviewed",
    query: new URLSearchParams(),
    body: null,
  });
  assert.equal(review.status, 200);
  assert.equal(review.body.message.status, "reviewed");

  const payment = await api.handle({
    method: "PATCH",
    pathname: "/api/orders/ord_1/payment",
    query: new URLSearchParams(),
    body: { paymentStatus: "paid", amountPaid: 228, method: "bank_transfer" },
  });
  assert.equal(payment.status, 200);
  assert.equal(payment.body.order.paymentStatus, "paid");
  assert.equal(payment.body.order.amountPaid, 228);
  assert.ok(database.snapshot().payments.some((row) => row.orderId === "ord_1"));
});

test("json database can persist and reload snapshots", async () => {
  const initial = createSeedDatabase().snapshot();
  const memory = new JsonDatabase({ initialData: initial });
  memory.update((data) => {
    data.businesses[0].name = "Reloadable Supply";
    return data;
  });

  const reloaded = new JsonDatabase({ initialData: memory.snapshot() });
  assert.equal(reloaded.snapshot().businesses[0].name, "Reloadable Supply");
});
