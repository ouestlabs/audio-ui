import type * as React from "react";
import { cn } from "@/registry/bases/base/lib/utils";

function UnorderedList({ className, ...props }: React.ComponentProps<"ul">) {
  return (
    <ul
      className={cn("my-6 ms-6 list-disc text-muted-foreground", className)}
      {...props}
    />
  );
}

function OrderedList({ className, ...props }: React.ComponentProps<"ol">) {
  return (
    <ol
      className={cn("my-6 ms-6 list-decimal text-muted-foreground", className)}
      {...props}
    />
  );
}

function ListItem({ className, ...props }: React.ComponentProps<"li">) {
  return <li className={cn("mt-2", className)} {...props} />;
}

export { UnorderedList, OrderedList, ListItem };
