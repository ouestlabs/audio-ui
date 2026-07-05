import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { cn } from "@/lib/utils";

export function Callout({
  title,
  children,
  icon,
  className,
  variant = "default",
  ...props
}: React.ComponentProps<typeof Alert> & {
  icon?: React.ReactNode;
  variant?: "default" | "info" | "warning";
}) {
  return (
    <Alert
      className={cn(
        "md:-mx-1 mt-6 w-auto border border-site-border bg-site-background text-site-foreground",
        className
      )}
      data-variant={variant}
      {...props}
    >
      {icon}
      {title && <AlertTitle>{title}</AlertTitle>}
      <AlertDescription className="text-site-card-foreground/80">
        {children}
      </AlertDescription>
    </Alert>
  );
}
