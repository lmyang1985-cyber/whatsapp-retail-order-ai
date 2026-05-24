export function getPackingTotals(orders, products, deliveryDate) {
  const totals = new Map();
  for (const order of activeOrdersForDate(orders, deliveryDate)) {
    for (const item of order.items) {
      const product = products.find((candidate) => candidate.id === item.productId);
      const current = totals.get(item.productId) ?? {
        productId: item.productId,
        productName: product?.name ?? "Unknown item",
        quantity: 0,
        unit: item.unit,
      };
      current.quantity += item.quantity;
      totals.set(item.productId, current);
    }
  }
  return [...totals.values()].sort((a, b) => a.productName.localeCompare(b.productName));
}

export function getDeliveryList(orders, customers, products, deliveryDate) {
  return activeOrdersForDate(orders, deliveryDate).map((order) => {
    const customer = customers.find((candidate) => candidate.id === order.customerId);
    return {
      orderId: order.id,
      customerName: customer?.businessName ?? "Unknown customer",
      address: customer?.address ?? "",
      phone: customer?.whatsappPhone ?? "",
      area: customer?.area ?? "",
      notes: order.notes,
      paymentStatus: order.paymentStatus,
      amountToCollect: Math.max(0, order.totalAmount - order.amountPaid),
      items: order.items
        .map((item) => {
          const product = products.find((candidate) => candidate.id === item.productId);
          return `${item.quantity} ${item.unit} ${product?.name ?? "Unknown item"}`;
        })
        .join(", "),
    };
  });
}

function activeOrdersForDate(orders, deliveryDate) {
  return orders.filter(
    (order) =>
      order.deliveryDate === deliveryDate &&
      !["cancelled", "draft", "needs_review"].includes(order.orderStatus),
  );
}
