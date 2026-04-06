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
          asChild
          size="sm"
          variant={currentCategory ? "outline" : "default"}
        >
          <Link href="/blocks">All</Link>
        </Button>
        {categories?.map((cat) => {
          const isActive = cat.slug === currentCategory;
          return (
            <Button
              asChild
              className="capitalize"
              key={cat.slug}
              size="sm"
              variant={isActive ? "default" : "outline"}
            >
              <Link href={`/blocks/${cat.slug}`}>{cat.name}</Link>
            </Button>
          );
        })}
      </div>
    </div>
  );
}
