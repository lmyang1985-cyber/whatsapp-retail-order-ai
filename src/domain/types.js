/**
 * Runtime type notes for the app's plain JavaScript data model.
 *
 * Business, User, Customer, Product, CustomerSpecialPrice, Order, OrderItem,
 * Message, and Payment objects mirror the fields in the design spec. Keeping
 * the app on plain objects makes the local dashboard easy to replace with API
 * responses later.
 */

export const orderStatuses = [
  "draft",
  "confirmed",
  "needs_review",
  "cancelled",
  "delivered",
];

export const paymentStatuses = ["unpaid", "partial", "paid", "credit"];
