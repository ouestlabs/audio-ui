import { baseUrl } from "@/lib/config";
import { Icons } from "@/lib/icons";
import { cn } from "@/registry/default/lib/utils";
import { Button } from "@/registry/default/ui/button";

export function OpenInV0Button({
  name,
  className,
  ...props
}: React.ComponentProps<typeof Button> & {
  name: string;
}) {
  return (
    <Button
      asChild
      className={cn("h-[1.8rem] gap-1", className)}
      size="sm"
      {...props}
    >
      <a
        href={`https://v0.dev/chat/api/open?url=${encodeURIComponent(`${baseUrl.origin}/r/${name}.json`)}`}
        target="_blank"
      >
        Open in <Icons.v0 className="size-5" />
      </a>
    </Button>
  );
}
