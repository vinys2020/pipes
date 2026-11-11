export type StoreProduct = {
  id: string;
  name: string;
  price: number;
  originalPrice: number;
  image: string;
  category: string;
  description: string;
  stock: number;
  numeroProducto: string;
  identificador: string;
  active: boolean;
};

export type CartQuantities = Record<string, number>;

export const DEFAULT_CATEGORIES = [
  "Ofertas",
  "Almacén",
  "Bebidas",
  "Snack y galletitas",
  "Golosinas y chocolates",
  "Pizzas",
  "Cigarrillos",
  "Cuidado personal",
  "Limpieza",
  "Analgésicos",
  "Otros",
];

export function normalizeCategoryName(category: string) {
  return category
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("es");
}

export function getStoreCategories(productCategories: string[]) {
  const categoriesByKey = new Map<string, string>();

  for (const category of DEFAULT_CATEGORIES) {
    categoriesByKey.set(normalizeCategoryName(category), category);
  }

  for (const category of productCategories) {
    const trimmed = category.trim();
    const key = normalizeCategoryName(trimmed);
    if (key && !categoriesByKey.has(key)) categoriesByKey.set(key, trimmed);
  }

  return [...categoriesByKey.values()];
}

type CategorizedProduct = Pick<
  StoreProduct,
  "category" | "price" | "originalPrice"
>;

export function productMatchesCategory(
  product: CategorizedProduct,
  category: string
) {
  const categoryKey = normalizeCategoryName(category);
  const isAssignedCategory =
    normalizeCategoryName(product.category) === categoryKey;
  const isActiveOffer =
    categoryKey === normalizeCategoryName("Ofertas") &&
    product.originalPrice > product.price;
  return isAssignedCategory || isActiveOffer;
}

export function getProductsForCategory<T extends CategorizedProduct>(
  products: readonly T[],
  category: string
) {
  return products.filter((product) => productMatchesCategory(product, category));
}

export function mapStoreProduct(
  id: string,
  data: Record<string, unknown>
): StoreProduct {
  return {
    id,
    name: String(data.name ?? ""),
    price: Number(data.price ?? 0),
    originalPrice: Number(data.originalPrice ?? 0),
    image: String(data.image ?? ""),
    category: String(data.category ?? "Otros"),
    description: String(data.description ?? ""),
    stock: Math.max(0, Number(data.stock ?? 0)),
    numeroProducto: String(data.numeroProducto ?? ""),
    identificador: String(data.identificador ?? ""),
    active: data.active !== false,
  };
}

export function readCartQuantities(): CartQuantities {
  try {
    const savedCart = sessionStorage.getItem("pipes-cart");
    if (!savedCart) return {};

    const parsed: unknown = JSON.parse(savedCart);
    if (
      typeof parsed !== "object" ||
      parsed === null ||
      Array.isArray(parsed)
    ) {
      return {};
    }

    return Object.fromEntries(
      Object.entries(parsed).filter(
        ([id, quantity]) =>
          id.length > 0 &&
          typeof quantity === "number" &&
          Number.isInteger(quantity) &&
          quantity > 0
      )
    );
  } catch (error) {
    console.error("No se pudo recuperar el carrito guardado:", error);
    return {};
  }
}

export function saveCartQuantities(quantities: CartQuantities) {
  try {
    sessionStorage.setItem("pipes-cart", JSON.stringify(quantities));
    return true;
  } catch (error) {
    console.error("No se pudo guardar el carrito en esta sesión:", error);
    return false;
  }
}

export function mergeCartItems(
  current: CartQuantities,
  items: Array<{ product: StoreProduct; quantity: number }>
): CartQuantities {
  const next = { ...current };
  for (const { product, quantity } of items) {
    if (!product.active || product.stock <= 0 || quantity <= 0) continue;
    next[product.id] = Math.min(
      product.stock,
      (next[product.id] ?? 0) + quantity
    );
  }
  return next;
}
