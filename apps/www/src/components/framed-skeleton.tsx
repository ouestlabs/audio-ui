import { Skeleton } from "@/components/ui/skeleton";

/** What the customizer offers, by name: the names are known, the choices are not yet. */
const CUSTOMIZER_CHOICES = [
  "Component Library",
  "Style",
  "Base Color",
  "Theme",
  "Chart Color",
  "Icon Library",
  "Heading",
  "Font",
  "Radius",
  "Menu",
  "Menu Accent",
] as const;

/** The customizer's choices before they are known: each has its name, only its value is awaited. */
export function CustomizerChoicesSkeleton() {
  return (
    <div aria-hidden className="flex flex-col gap-1 p-2">
      {CUSTOMIZER_CHOICES.map((name) => (
        <div className="flex items-center justify-between p-2" key={name}>
          <div className="flex flex-col gap-1.5">
            <span className="text-site-muted-foreground text-xs">{name}</span>
            <Skeleton className="h-4 w-24" />
          </div>
          <Skeleton className="size-4 rounded-full" />
        </div>
      ))}
    </div>
  );
}

/** The customizer while its choices read the URL. */
export function CustomizerSkeleton() {
  return (
    <aside className="customizer-aside hidden w-64 shrink-0 flex-col lg:flex">
      <CustomizerChoicesSkeleton />
    </aside>
  );
}
