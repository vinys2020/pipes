import CategoryProductShelf, { type CategoryShelfProps } from "./CategoryProductShelf";

export default function Bebidas(props: CategoryShelfProps) {
  return (
    <CategoryProductShelf
      {...props}
      category="Bebidas"
      eyebrow="ALGO RICO PARA TOMAR"
    />
  );
}
