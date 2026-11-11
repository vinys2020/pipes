import CategoryProductShelf, { type CategoryShelfProps } from "./CategoryProductShelf";

export default function Almacen(props: CategoryShelfProps) {
  return (
    <CategoryProductShelf
      {...props}
      category="Almacén"
      eyebrow="LO ESENCIAL PARA TU CASA"
    />
  );
}
