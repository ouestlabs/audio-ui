import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  PageHeader,
  PageHeaderDescription,
  PageHeaderHeading,
} from "@/components/layouts/global/headers/page";
import { createMetadata } from "@/lib/metadata";
import { getUniqueParticleCategories } from "@/lib/particle-categories";
import { blocks } from "@/registry/bases/base/blocks";
import { cn } from "@/registry/bases/base/lib/utils";

import { BlockDisplay } from "../block-display";
import { CategoryNavigation } from "../category-navigation";

const blockCategories = getUniqueParticleCategories(blocks);

function getCategoryDetails(categorySlug: string) {
  const categoryObj = blockCategories.find((cat) => cat.slug === categorySlug);

  if (!categoryObj) {
    return { categoryObj: null, categoryBlocks: [] };
  }

  const categoryBlocks = blocks.filter((block) =>
    block.category?.includes(categoryObj.name)
  );

  return { categoryObj, categoryBlocks };
}

export function generateStaticParams() {
  return blockCategories.map((category) => ({
    category: category.slug,
  }));
}

export async function generateMetadata({
  params,
}: PageProps<"/blocks/[category]">): Promise<Metadata> {
  const { category: categorySlug } = await params;
  const { categoryObj, categoryBlocks } = getCategoryDetails(categorySlug);

  if (!categoryObj) {
    notFound();
  }

  return createMetadata({
    title: `${
      categoryObj.name.charAt(0).toUpperCase() + categoryObj.name.slice(1)
    } blocks`,
    description: `Showing ${categoryBlocks.length} block${
      categoryBlocks.length !== 1 ? "s" : ""
    } in the ${categoryObj.name} category`,
  });
}

export default async function CategoryPage({
  params,
}: PageProps<"/blocks/[category]">) {
  const { category: categorySlug } = await params;
  const { categoryObj, categoryBlocks } = getCategoryDetails(categorySlug);

  if (!categoryObj) {
    notFound();
  }

  if (categoryBlocks.length === 0) {
    notFound();
  }

  return (
    <div className="container w-full">
      <PageHeader>
        <PageHeaderHeading>
          <span className="capitalize">{categoryObj.name}</span> blocks
        </PageHeaderHeading>
        <PageHeaderDescription>
          Showing {categoryBlocks.length} block
          {categoryBlocks.length !== 1 ? "s" : ""} in the {categoryObj.name}{" "}
          category
        </PageHeaderDescription>
        <CategoryNavigation
          categories={blockCategories}
          currentCategory={categorySlug}
        />
      </PageHeader>
      <div className="grid flex-1 items-stretch gap-3 pb-12 lg:grid-cols-2">
        {categoryBlocks.map((block) => {
          const BlockComponent = block.component;
          return (
            <BlockDisplay
              className={cn(
                block.fullWidth ? "lg:col-span-2" : "lg:col-span-1",
                block.className
              )}
              key={block.id}
              name={block.id}
            >
              <BlockComponent />
            </BlockDisplay>
          );
        })}
      </div>
    </div>
  );
}
