import CategoryProductShelf, { type CategoryShelfProps } from "./CategoryProductShelf";

export default function Cigarrillos(props: CategoryShelfProps) {
  return (
    <CategoryProductShelf
      {...props}
      category="Cigarrillos"
      eyebrow="PRODUCTOS DEL CATÁLOGO"
    />
  );
}
