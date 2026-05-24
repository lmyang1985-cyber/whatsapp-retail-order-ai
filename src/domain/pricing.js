export function priceOrderItems(items, customerId, products, specialPrices) {
  return items.map((item) => {
    const product = products.find((candidate) => candidate.id === item.productId);
    const specialPrice = specialPrices.find(
      (price) =>
        price.customerId === customerId &&
        price.productId === item.productId &&
        price.active,
    );
    const unitPrice = item.unitPrice ?? specialPrice?.price ?? product?.defaultPrice ?? 0;
    return {
      productId: item.productId,
      quantity: item.quantity,
      unit: product?.unit ?? item.unit ?? "custom",
      unitPrice,
      lineTotal: roundMoney(item.quantity * unitPrice),
      manualPriceOverride: Boolean(item.manualPriceOverride),
    };
  });
}

export function roundMoney(value) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}
