import CategoryProductShelf, { type CategoryShelfProps } from "./CategoryProductShelf";

export default function Pizzas(props: CategoryShelfProps) {
  return (
    <CategoryProductShelf
      {...props}
      category="Pizzas"
      eyebrow="RESOLVÉ TU COMIDA"
    />
  );
}
