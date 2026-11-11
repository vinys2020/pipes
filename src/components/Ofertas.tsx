import CategoryProductShelf, { type CategoryShelfProps } from "./CategoryProductShelf";

export default function Ofertas(props: CategoryShelfProps) {
  return (
    <CategoryProductShelf
      {...props}
      category="Ofertas"
      eyebrow="PRECIOS ESPECIALES"
    />
  );
}
