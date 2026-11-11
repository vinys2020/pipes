import CategoryProductShelf, { type CategoryShelfProps } from "./CategoryProductShelf";

export default function Limpieza(props: CategoryShelfProps) {
  return (
    <CategoryProductShelf
      {...props}
      category="Limpieza"
      eyebrow="TODO PARA TU HOGAR"
    />
  );
}
