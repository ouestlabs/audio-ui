import Link from "next/link";
import { Button } from "@/registry/default/ui/button";

type CategoryNavigationProps = {
  currentCategory?: string;
  categories?: Array<{ name: string; slug: string }>;
};

export function CategoryNavigation({
  currentCategory,
  categories,
}: CategoryNavigationProps) {
  return (
    <div className="mx-auto mt-4 w-full max-w-4xl">
      <div className="flex flex-wrap justify-center gap-2">
        <Button
          render={<Link href="/blocks" />}
          size="sm"
          variant={currentCategory ? "outline" : "default"}
        >
          All
        </Button>
        {categories?.map((cat) => {
          const isActive = cat.slug === currentCategory;
          return (
            <Button
              className="capitalize"
              key={cat.slug}
              render={<Link href={`/blocks/${cat.slug}`} />}
              size="sm"
              variant={isActive ? "default" : "outline"}
            >
              {cat.name}
            </Button>
          );
        })}
      </div>
    </div>
  );
}
