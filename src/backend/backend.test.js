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

test("customer endpoints list, create, edit, and deactivate customers", async () => {
  const database = createSeedDatabase();
  const api = createApi({ database });

  const list = await api.handle({
    method: "GET",
    pathname: "/api/customers",
    query: new URLSearchParams(),
    body: null,
  });
  assert.equal(list.status, 200);
  assert.equal(list.body.customers.length, 3);

  const create = await api.handle({
    method: "POST",
    pathname: "/api/customers",
    query: new URLSearchParams(),
    body: {
      businessName: "Harbour Juice Bar",
      whatsappPhone: "+60170001111",
      contactPerson: "Nora",
      address: "Lot 4, Harbour Walk",
      area: "Penang",
      customerType: "cafe",
      paymentTerms: "weekly",
    },
  });
  assert.equal(create.status, 201);
  assert.equal(create.body.customer.active, true);
  assert.equal(create.body.customer.businessName, "Harbour Juice Bar");

  const update = await api.handle({
    method: "PATCH",
    pathname: `/api/customers/${create.body.customer.id}`,
    query: new URLSearchParams(),
    body: { area: "Georgetown", paymentTerms: "monthly" },
  });
  assert.equal(update.status, 200);
  assert.equal(update.body.customer.area, "Georgetown");
  assert.equal(update.body.customer.paymentTerms, "monthly");

  const deactivate = await api.handle({
    method: "DELETE",
    pathname: `/api/customers/${create.body.customer.id}`,
    query: new URLSearchParams(),
    body: null,
  });
  assert.equal(deactivate.status, 200);
  assert.equal(deactivate.body.customer.active, false);
});

test("product endpoints list, create, edit aliases, and deactivate products", async () => {
  const database = createSeedDatabase();
  const api = createApi({ database });

  const list = await api.handle({
    method: "GET",
    pathname: "/api/products",
    query: new URLSearchParams(),
    body: null,
  });
  assert.equal(list.status, 200);
  assert.equal(list.body.products.length, 3);

  const create = await api.handle({
    method: "POST",
    pathname: "/api/products",
    query: new URLSearchParams(),
    body: {
      name: "Coconut Jelly Cup",
      aliases: ["jelly", "cup"],
      unit: "box",
      defaultPrice: 18.5,
    },
  });
  assert.equal(create.status, 201);
  assert.equal(create.body.product.name, "Coconut Jelly Cup");

  const update = await api.handle({
    method: "PATCH",
    pathname: `/api/products/${create.body.product.id}`,
    query: new URLSearchParams(),
    body: { aliases: ["jelly cup", "agar"], defaultPrice: 19.25 },
  });
  assert.equal(update.status, 200);
  assert.deepEqual(update.body.product.aliases, ["jelly cup", "agar"]);
  assert.equal(update.body.product.defaultPrice, 19.25);

  const deactivate = await api.handle({
    method: "DELETE",
    pathname: `/api/products/${create.body.product.id}`,
    query: new URLSearchParams(),
    body: null,
  });
  assert.equal(deactivate.status, 200);
  assert.equal(deactivate.body.product.active, false);
});

test("order endpoints create manual order, edit items, cancel, and deliver", async () => {
  const database = createSeedDatabase();
  const api = createApi({ database });

  const create = await api.handle({
    method: "POST",
    pathname: "/api/orders",
    query: new URLSearchParams(),
    body: {
      customerId: "cust_green_bowl",
      deliveryDate: "2026-05-26",
      notes: "Manual afternoon top-up",
      items: [{ productId: "prod_young", quantity: 20 }],
    },
  });
  assert.equal(create.status, 201);
  assert.equal(create.body.order.source, "manual");
  assert.equal(create.body.order.totalAmount, 57);

  const update = await api.handle({
    method: "PATCH",
    pathname: `/api/orders/${create.body.order.id}`,
    query: new URLSearchParams(),
    body: {
      deliveryDate: "2026-05-27",
      orderStatus: "confirmed",
      notes: "Updated top-up",
      items: [{ productId: "prod_old", quantity: 30 }],
    },
  });
  assert.equal(update.status, 200);
  assert.equal(update.body.order.deliveryDate, "2026-05-27");
  assert.equal(update.body.order.items[0].productId, "prod_old");
  assert.equal(update.body.order.totalAmount, 72);

  const delivered = await api.handle({
    method: "POST",
    pathname: `/api/orders/${create.body.order.id}/delivered`,
    query: new URLSearchParams(),
    body: null,
  });
  assert.equal(delivered.status, 200);
  assert.equal(delivered.body.order.orderStatus, "delivered");

  const cancelled = await api.handle({
    method: "POST",
    pathname: `/api/orders/${create.body.order.id}/cancel`,
    query: new URLSearchParams(),
    body: { reason: "Customer changed plan" },
  });
  assert.equal(cancelled.status, 200);
  assert.equal(cancelled.body.order.orderStatus, "cancelled");
  assert.match(cancelled.body.order.notes, /Customer changed plan/);
});
