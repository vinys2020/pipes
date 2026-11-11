import CategoryProductShelf, { type CategoryShelfProps } from "./CategoryProductShelf";

export default function OtrosProductos(props: CategoryShelfProps) {
  return (
    <CategoryProductShelf
      {...props}
      category="Otros"
      eyebrow="MÁS PARA ELEGIR"
    />
  );
}
