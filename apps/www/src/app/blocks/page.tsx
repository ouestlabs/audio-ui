import {
  PageHeader,
  PageHeaderDescription,
  PageHeaderHeading,
} from "@/components/layouts/global/headers/page";
import { createMetadata } from "@/lib/metadata";
import { getUniqueParticleCategories } from "@/lib/particle-categories";
import { blocks } from "@/registry/bases/base/blocks";
import { cn } from "@/registry/bases/base/lib/utils";

import { BlockDisplay } from "./block-display";
import { CategoryNavigation } from "./category-navigation";

const blockCategories = getUniqueParticleCategories(blocks);

const title = "Blocks";
const description =
  "Blocks are pre-assembled components that combine primitives into complete patterns. Browse by category or explore them all.";

export const metadata = createMetadata({
  title,
  description,
});

export default function Page() {
  return (
    <div className="container w-full">
      <PageHeader>
        <PageHeaderHeading>{title}</PageHeaderHeading>
        <PageHeaderDescription className="max-w-2xl">
          {description}
        </PageHeaderDescription>
        <CategoryNavigation categories={blockCategories} />
      </PageHeader>
      <div className="grid flex-1 items-stretch gap-3 pb-12 lg:grid-cols-2">
        {blocks.map((block) => {
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
