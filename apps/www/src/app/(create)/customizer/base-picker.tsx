"use client";

import * as React from "react";
import {
  Picker,
  PickerContent,
  PickerGroup,
  PickerRadioGroup,
  PickerRadioItem,
  PickerTrigger,
} from "@/app/(create)/customizer/picker";
import { useDesignSystemSearchParams } from "@/app/(create)/lib/search-params";
import { useConfig } from "@/hooks/use-config";
import { useMounted } from "@/hooks/use-mounted";
import { BASES as ALL_BASES } from "@/registry/config";

// Base-only launch: audio components only exist for the Base UI base.
const BASES = (ALL_BASES as any[]).filter((base) => base.name === "base");

export function BasePicker({
  isMobile,
  anchorRef,
}: {
  isMobile: boolean;
  anchorRef: React.RefObject<HTMLDivElement | null>;
}) {
  const mounted = useMounted();
  const [params, setParams] = useDesignSystemSearchParams();
  const [config, setConfig] = useConfig();

  const currentBase = React.useMemo(
    () =>
      (BASES as any[]).find(
        (base) => base.name === (params.base ?? config.base)
      ),
    [params.base, config.base]
  );

  const handleValueChange = React.useCallback(
    (value: string) => {
      const newBase = (BASES as any[]).find((base) => base.name === value);
      if (!newBase) {
        return;
      }

      setParams({ base: newBase.name });
      setConfig((prev) => ({ ...prev, base: newBase.name as any }));
    },
    [setParams, setConfig]
  );

  return (
    <Picker>
      <PickerTrigger>
        <div className="flex flex-col justify-start text-left">
          <div className="text-site-muted-foreground text-xs">
            Component Library
          </div>
          <div className="font-medium text-site-foreground text-sm">
            {mounted ? currentBase?.title : "..."}
          </div>
        </div>
        {mounted && currentBase?.meta?.logo && (
          <div
            className="-translate-y-1/2 pointer-events-none absolute top-1/2 right-4 size-4 select-none text-site-foreground *:[svg]:size-4 *:[svg]:text-site-foreground!"
            dangerouslySetInnerHTML={{
              __html: currentBase.meta.logo,
            }}
          />
        )}
      </PickerTrigger>
      <PickerContent
        align={isMobile ? "center" : "start"}
        anchor={isMobile ? anchorRef : undefined}
        side={isMobile ? "top" : "right"}
      >
        <PickerRadioGroup
          onValueChange={handleValueChange}
          value={currentBase?.name}
        >
          <PickerGroup>
            {(BASES as any[]).map((base) => (
              <PickerRadioItem key={base.name} value={base.name}>
                {base.meta?.logo && (
                  <div
                    className="size-4 shrink-0 text-site-foreground [&_svg]:size-4 *:[svg]:text-site-foreground!"
                    dangerouslySetInnerHTML={{
                      __html: base.meta.logo,
                    }}
                  />
                )}
                {base.title}
              </PickerRadioItem>
            ))}
          </PickerGroup>
        </PickerRadioGroup>
      </PickerContent>
    </Picker>
  );
}
