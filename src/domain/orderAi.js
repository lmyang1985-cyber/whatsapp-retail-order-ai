const pricePaymentTerms = [
  "price",
  "cheaper",
  "discount",
  "pay",
  "paid",
  "payment",
  "bank",
  "transfer",
  "owe",
  "hutang",
  "bayar",
  "complaint",
  "wrong",
  "refund",
];

const languageHints = [
  { language: "Malay", terms: ["esok", "hantar", "kelapa", "muda", "tua"] },
  { language: "Chinese", terms: ["椰", "明天", "今天"] },
  { language: "English", terms: ["today", "tomorrow", "young", "old", "deliver"] },
];

export function normalizePhone(phone) {
  const digits = String(phone).replace(/\D/g, "");
  if (digits.startsWith("60")) return `+${digits}`;
  if (digits.startsWith("0")) return `+6${digits}`;
  return phone.startsWith("+") ? `+${digits}` : `+${digits}`;
}

export function interpretMessage({
  businessId,
  fromPhone,
  text,
  receivedAt,
  customers,
  products,
}) {
  const normalizedText = text.toLowerCase();
  const customer = customers.find(
    (candidate) =>
      candidate.businessId === businessId &&
      candidate.active &&
      normalizePhone(candidate.whatsappPhone) === normalizePhone(fromPhone),
  );
  const reviewReasons = [];

  if (!customer) reviewReasons.push("unknown_customer");
  if (pricePaymentTerms.some((term) => normalizedText.includes(term))) {
    reviewReasons.push("price_or_payment_discussion");
  }

  const product = findProduct(products, businessId, normalizedText, text);
  const quantity = extractQuantity(text);
  const deliveryDate = extractDeliveryDate(normalizedText, receivedAt);
  const detectedLanguage = detectLanguage(text);

  if (!product) reviewReasons.push("unknown_item");
  if (!deliveryDate) reviewReasons.push("confusing_delivery_date");
  if (quantity && quantity > 500) reviewReasons.push("unusually_large_quantity");

  if (reviewReasons.length > 0) {
    return {
      status: "needs_review",
      customer,
      detectedLanguage,
      confidence: 0.42,
      reviewReasons,
      replyText: undefined,
      orderDraft: product && quantity && deliveryDate
        ? draftOrder(product, quantity, deliveryDate)
        : undefined,
    };
  }

  if (!quantity && product) {
    return {
      status: "clarification",
      customer,
      detectedLanguage,
      confidence: 0.68,
      reviewReasons: ["missing_quantity"],
      replyText: `How many ${product.name} would you like?`,
      orderDraft: undefined,
    };
  }

  if (!quantity) {
    return {
      status: "needs_review",
      customer,
      detectedLanguage,
      confidence: 0.35,
      reviewReasons: ["missing_quantity"],
      replyText: undefined,
      orderDraft: undefined,
    };
  }

  const orderDraft = draftOrder(product, quantity, deliveryDate);

  return {
    status: "confirmed",
    customer,
    detectedLanguage,
    confidence: 0.91,
    reviewReasons: [],
    replyText: buildConfirmation(orderDraft, detectedLanguage),
    orderDraft,
  };
}

function findProduct(products, businessId, normalizedText, originalText) {
  return products.find((product) => {
    if (product.businessId !== businessId || !product.active) return false;
    const terms = [product.name, ...product.aliases].map((alias) => alias.toLowerCase());
    return terms.some((term) => normalizedText.includes(term) || originalText.includes(term));
  });
}

function extractQuantity(text) {
  const match = text.match(/\b(\d+(?:\.\d+)?)\b/);
  return match ? Number(match[1]) : null;
}

function extractDeliveryDate(text, receivedAt) {
  const date = new Date(receivedAt);
  if (text.includes("today") || text.includes("hari ini") || text.includes("今天")) {
    return toDateKey(date);
  }
  if (text.includes("tomorrow") || text.includes("esok") || text.includes("明天")) {
    date.setDate(date.getDate() + 1);
    return toDateKey(date);
  }
  const iso = text.match(/\b(20\d{2}-\d{2}-\d{2})\b/);
  if (iso) return iso[1];
  return null;
}

function detectLanguage(text) {
  const lower = text.toLowerCase();
  const matches = languageHints.filter(({ terms }) =>
    terms.some((term) => lower.includes(term) || text.includes(term)),
  );
  if (matches.length > 1) return "Mixed";
  return matches[0]?.language ?? "English";
}

function draftOrder(product, quantity, deliveryDate) {
  return {
    deliveryDate,
    items: [
      {
        productId: product.id,
        productName: product.name,
        quantity,
        unit: product.unit,
      },
    ],
  };
}

function buildConfirmation(orderDraft) {
  const item = orderDraft.items[0];
  return `Confirmed: ${item.quantity} ${item.productName} for delivery ${friendlyDate(
    orderDraft.deliveryDate,
  )}. Reply CHANGE if wrong.`;
}

function friendlyDate(dateKey) {
  return dateKey;
}

function toDateKey(date) {
  return date.toISOString().slice(0, 10);
}
