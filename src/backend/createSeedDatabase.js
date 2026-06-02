import {
  business,
  customers,
  initialMessages,
  initialOrders,
  initialPayments,
  products,
  specialPrices,
  users,
} from "../data/seedData.js";
import { JsonDatabase } from "./jsonDatabase.js";

export function createSeedDatabase({ filePath } = {}) {
  return new JsonDatabase({
    filePath,
    initialData: {
      businesses: [business],
      users,
      customers,
      products,
      customerSpecialPrices: specialPrices,
      orders: initialOrders,
      messages: initialMessages,
      payments: initialPayments,
    },
  });
}
