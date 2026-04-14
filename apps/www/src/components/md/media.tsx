import type * as React from "react";
import { cn } from "@/registry/default/lib/utils";

function Img({
  className,
  alt,
  height,
  width,
  ...props
}: React.ComponentProps<"img">) {
  return (
    // biome-ignore lint/performance/noImgElement: use native <img> element instead of next/image.
    <img
      alt={alt}
      className={cn("rounded-md", className)}
      height={height}
      width={width}
      {...props}
    />
  );
}

function HorizontalRule({ ...props }: React.ComponentProps<"hr">) {
  return <hr className="my-4 md:my-8" {...props} />;
}

export { Img, HorizontalRule };
