import Link from "next/link";

import { PAGES_NEW } from "@/lib/docs";
import { source } from "@/lib/source";
import { Badge } from "@/registry/bases/base/ui/badge";

export function ComponentsList() {
  const components = source.pageTree.children.find(
    (page) => page.name === "Components"
  );

  if (components?.type !== "folder") {
    return null;
  }

  const list: Array<{
    url: string;
    name: string;
    $id: string;
    isUI?: boolean;
  }> = [];

  for (const item of components.children) {
    if (item.type === "page" && item.name && item.$id) {
      list.push({
        url: item.url,
        name: String(item.name),
        $id: item.$id,
        isUI: false,
      });
    } else if (item.type === "folder") {
      const isUIFolder = Boolean(item.name === "UI");
      for (const child of item.children) {
        if (child.type === "page" && child.name && child.$id) {
          list.push({
            url: child.url,
            name: String(child.name),
            $id: child.$id,
            isUI: isUIFolder,
          });
        }
      }
    }
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 md:gap-x-8 lg:gap-x-16 lg:gap-y-6 xl:gap-x-20">
      {list.map((component) => (
        <Link
          className="inline-flex items-center gap-2 font-medium text-lg underline-offset-4 hover:underline md:text-base"
          href={component.url}
          key={component.$id}
        >
          {component.name}
          <span className="flex items-center gap-1.5">
            {component.isUI && (
              <Badge
                title="UI Component"
                variant={
                  PAGES_NEW.includes(component.url) ? "default" : "outline"
                }
              >
                UI
              </Badge>
            )}
            {!component.isUI && PAGES_NEW.includes(component.url) && (
              <span
                className="flex size-2 rounded-full bg-primary"
                title="New"
              />
            )}
          </span>
        </Link>
      ))}
    </div>
  );
}
