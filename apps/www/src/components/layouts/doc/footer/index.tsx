import { ArrowLeftIcon, ArrowRightIcon } from "@phosphor-icons/react/dist/ssr";
import type { Item } from "fumadocs-core/page-tree";
import Link from "next/link";
import { Button } from "@/registry/bases/base/ui/button";

type DocFooterProps = {
  neighbours: {
    previous?: Item;
    next?: Item;
  };
};

export function DocFooter({ neighbours }: DocFooterProps) {
  return (
    <div className="flex items-center gap-2 pt-6">
      {neighbours.previous && (
        <Button
          className="shadow-none"
          nativeButton={false}
          render={<Link href={neighbours.previous.url} />}
          variant="outline"
        >
          <ArrowLeftIcon /> {neighbours.previous.name}
        </Button>
      )}
      {neighbours.next && (
        <Button
          className="ms-auto shadow-none"
          nativeButton={false}
          render={<Link href={neighbours.next.url} />}
          variant="outline"
        >
          {neighbours.next.name} <ArrowRightIcon />
        </Button>
      )}
    </div>
  );
}
