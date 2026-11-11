import CategoryProductShelf, { type CategoryShelfProps } from "./CategoryProductShelf";

export default function SnacksGalletitas(props: CategoryShelfProps) {
  return (
    <CategoryProductShelf
      {...props}
      category="Snack y galletitas"
      eyebrow="PARA PICAR Y COMPARTIR"
    />
  );
}
