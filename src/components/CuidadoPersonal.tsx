import CategoryProductShelf, { type CategoryShelfProps } from "./CategoryProductShelf";

export default function CuidadoPersonal(props: CategoryShelfProps) {
  return (
    <CategoryProductShelf
      {...props}
      category="Cuidado personal"
      eyebrow="CUIDADO DE TODOS LOS DÍAS"
    />
  );
}
