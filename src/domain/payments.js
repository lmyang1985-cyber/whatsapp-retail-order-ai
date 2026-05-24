import { roundMoney } from "./pricing.js";

export function calculateCustomerBalance(customerId, orders, payments) {
  const orderTotal = orders
    .filter((order) => order.customerId === customerId && order.orderStatus !== "cancelled")
    .reduce((sum, order) => sum + order.totalAmount, 0);
  const paidTotal = payments
    .filter((payment) => payment.customerId === customerId)
    .reduce((sum, payment) => sum + payment.amount, 0);
  return roundMoney(orderTotal - paidTotal);
}
