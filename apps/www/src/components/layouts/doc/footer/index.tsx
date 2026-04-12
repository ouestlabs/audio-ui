import type { Item } from "fumadocs-core/page-tree";
import { ArrowLeftIcon, ArrowRightIcon } from "lucide-react";
import Link from "next/link";
import { Button } from "@/registry/default/ui/button";

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
          render={<Link href={neighbours.previous.url} />}
          variant="outline"
        >
          <ArrowLeftIcon /> {neighbours.previous.name}
        </Button>
      )}
      {neighbours.next && (
        <Button
          className="ms-auto shadow-none"
          render={<Link href={neighbours.next.url} />}
          variant="outline"
        >
          {neighbours.next.name} <ArrowRightIcon />
        </Button>
      )}
    </div>
  );
}
