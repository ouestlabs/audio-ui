"use client";

import * as React from "react";
import { LockButton } from "@/app/(create)/customizer/lock-button";
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
import { MENU_ACCENTS, type MenuAccentValue } from "@/registry/config";

export function MenuAccentPicker({
  isMobile,
  anchorRef,
}: {
  isMobile: boolean;
  anchorRef: React.RefObject<HTMLDivElement | null>;
}) {
  const mounted = useMounted();
  const [params, setParams] = useDesignSystemSearchParams();
  const [config, setConfig] = useConfig();

  const menuAccentValue = params.menuAccent ?? config.menuAccent;
  const currentAccent = MENU_ACCENTS.find(
    (accent) => accent.value === menuAccentValue
  );

  const handleValueChange = React.useCallback(
    (value: string) => {
      const newMenuAccent = value as MenuAccentValue;
      setParams({ menuAccent: newMenuAccent });
      setConfig((prev) => ({ ...prev, menuAccent: newMenuAccent }));
    },
    [setParams, setConfig]
  );

  return (
    <div className="group/picker relative">
      <Picker>
        <PickerTrigger>
          <div className="flex flex-col justify-start text-left">
            <div className="text-site-muted-foreground text-xs">
              Menu Accent
            </div>
            <div className="font-medium text-site-foreground text-sm">
              {mounted ? currentAccent?.label : "..."}
            </div>
          </div>
          {mounted ? (
            <div className="-translate-y-1/2 pointer-events-none absolute top-1/2 right-4 flex size-4 select-none items-center justify-center text-base text-site-foreground">
              <svg
                className="text-site-foreground"
                fill="none"
                height="128"
                viewBox="0 0 24 24"
                width="128"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  className="fill-site-muted-foreground/30 data-[accent=bold]:fill-site-foreground"
                  d="M19 12.1294L12.9388 18.207C11.1557 19.9949 10.2641 20.8889 9.16993 20.9877C8.98904 21.0041 8.80705 21.0041 8.62616 20.9877C7.53195 20.8889 6.64039 19.9949 4.85726 18.207L2.83687 16.1811C1.72104 15.0622 1.72104 13.2482 2.83687 12.1294M19 12.1294L10.9184 4.02587M19 12.1294H2.83687M10.9184 4.02587L2.83687 12.1294M10.9184 4.02587L8.89805 2"
                  data-accent={currentAccent?.value}
                  stroke="currentColor"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                />
                <path
                  className="fill-site-muted-foreground/30 data-[accent=bold]:fill-site-foreground"
                  d="M22 20C22 21.1046 21.1046 22 20 22C18.8954 22 18 21.1046 18 20C18 18.8954 20 17 20 17C20 17 22 18.8954 22 20Z"
                  data-accent={currentAccent?.value}
                  stroke="currentColor"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                />
              </svg>
            </div>
          ) : (
            <div
              aria-hidden
              className="-translate-y-1/2 pointer-events-none absolute top-1/2 right-4 size-4"
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
            value={currentAccent?.value}
          >
            <PickerGroup>
              {MENU_ACCENTS.map((accent) => (
                <PickerRadioItem key={accent.value} value={accent.value}>
                  {accent.label}
                </PickerRadioItem>
              ))}
            </PickerGroup>
          </PickerRadioGroup>
        </PickerContent>
      </Picker>
      <LockButton
        className="-translate-y-1/2 absolute top-1/2 right-10"
        param="menuAccent"
      />
    </div>
  );
}
