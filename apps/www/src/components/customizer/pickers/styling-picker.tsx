import { type RefObject, useCallback } from "react";
import {
  Picker,
  PickerContent,
  PickerGroup,
  PickerRadioGroup,
  PickerRadioItem,
  PickerTrigger,
  usePickerSide,
} from "@/components/customizer/pickers/picker";
import { Icons } from "@/components/site/icons";
import { useMounted } from "@/hooks/use-mounted";
import { useStyling } from "@/hooks/use-styling";
import { STYLINGS, type StylingId } from "@/lib/docs/content/stylings";

function StylingIcon({ id }: { id: StylingId }) {
  return id === "css" ? (
    <Icons.css className="size-4 shrink-0 text-site-foreground" />
  ) : (
    <Icons.tailwind className="size-4 shrink-0 text-site-foreground" />
  );
}

/** How the custom elements' examples write their styles: CSS or Tailwind, as the code shows them. */
export function StylingPicker({
  isMobile,
  anchorRef,
}: {
  isMobile: boolean;
  anchorRef: RefObject<HTMLDivElement | null>;
}) {
  const mounted = useMounted();
  const [styling, choose] = useStyling();
  const current = STYLINGS.find((each) => each.id === styling);
  const side = usePickerSide(isMobile);
  const handleValueChange = useCallback(
    (value: string) => choose(value as StylingId),
    [choose]
  );

  return (
    <Picker>
      <PickerTrigger>
        <div className="flex flex-col justify-start text-left">
          <div className="text-site-muted-foreground text-xs">Styling</div>
          <div className="font-medium text-site-foreground text-sm">
            {mounted ? current?.label : "..."}
          </div>
        </div>
        {mounted ? (
          <div className="-translate-y-1/2 pointer-events-none absolute top-1/2 right-4 select-none">
            <StylingIcon id={styling} />
          </div>
        ) : null}
      </PickerTrigger>
      <PickerContent
        align={isMobile ? "center" : "start"}
        anchor={isMobile ? anchorRef : undefined}
        side={side}
      >
        <PickerRadioGroup onValueChange={handleValueChange} value={styling}>
          <PickerGroup>
            {STYLINGS.map((each) => (
              <PickerRadioItem key={each.id} value={each.id}>
                <div className="flex items-start gap-2">
                  <div className="flex h-5 items-center">
                    <StylingIcon id={each.id} />
                  </div>
                  <div className="flex flex-col justify-start pointer-coarse:gap-1">
                    <div>{each.label}</div>
                    <div className="pointer-coarse:text-sm text-site-muted-foreground text-xs">
                      {each.description}
                    </div>
                  </div>
                </div>
              </PickerRadioItem>
            ))}
          </PickerGroup>
        </PickerRadioGroup>
      </PickerContent>
    </Picker>
  );
}
