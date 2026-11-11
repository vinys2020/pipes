import CategoryProductShelf, { type CategoryShelfProps } from "./CategoryProductShelf";

export default function Analgesicos(props: CategoryShelfProps) {
  return (
    <CategoryProductShelf
      {...props}
      category="Analgésicos"
      eyebrow="BOTIQUÍN"
    />
  );
}
