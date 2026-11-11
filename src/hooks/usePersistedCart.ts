import { useState } from "react";
import {
  mergeCartItems,
  readCartQuantities,
  saveCartQuantities,
  type CartQuantities,
  type StoreProduct,
} from "../lib/storefront";

export function usePersistedCart() {
  const [quantities, setQuantities] = useState<CartQuantities>(
    readCartQuantities
  );
  const cartCount = Object.values(quantities).reduce(
    (total, quantity) => total + quantity,
    0
  );

  const addProduct = (product: StoreProduct) => {
    const next = mergeCartItems(quantities, [{ product, quantity: 1 }]);
    saveCartQuantities(next);
    setQuantities(next);
    return next[product.id] > (quantities[product.id] ?? 0);
  };

  const addItems = (
    items: Array<{ product: StoreProduct; quantity: number }>
  ) => {
    const next = mergeCartItems(quantities, items);
    saveCartQuantities(next);
    setQuantities(next);
    return next;
  };

  return { quantities, cartCount, addProduct, addItems };
}
