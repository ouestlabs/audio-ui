"use client";

import * as React from "react";
import { LockButton } from "@/app/(create)/customizer/lock-button";
import {
  Picker,
  PickerContent,
  PickerGroup,
  PickerRadioGroup,
  PickerRadioItem,
  PickerSeparator,
  PickerTrigger,
} from "@/app/(create)/customizer/picker";
import { useDesignSystemSearchParams } from "@/app/(create)/lib/search-params";
import { useConfig } from "@/hooks/use-config";
import { useMounted } from "@/hooks/use-mounted";
import type { Style, StyleName } from "@/registry/config";

export function StylePicker({
  styles,
  isMobile,
  anchorRef,
}: {
  styles: readonly Style[];
  isMobile: boolean;
  anchorRef: React.RefObject<HTMLDivElement | null>;
}) {
  const mounted = useMounted();
  const [params, setParams] = useDesignSystemSearchParams();
  const [config, setConfig] = useConfig();

  const styleValue = params.style ?? config.style;
  const currentStyle = styles.find((style) => style.name === styleValue);

  const handleValueChange = React.useCallback(
    (value: string) => {
      const newStyle = value as StyleName;
      setParams({ style: newStyle });
      setConfig((prev) => ({ ...prev, style: newStyle }));
    },
    [setParams, setConfig]
  );

  return (
    <div className="group/picker relative">
      <Picker>
        <PickerTrigger>
          <div className="flex flex-col justify-start text-left">
            <div className="text-site-muted-foreground text-xs">Style</div>
            <div className="font-medium text-site-foreground text-sm">
              {mounted ? currentStyle?.title : "..."}
            </div>
          </div>
          {mounted && currentStyle?.icon && (
            <div className="-translate-y-1/2 pointer-events-none absolute top-1/2 right-4 flex size-4 select-none items-center justify-center">
              {React.cloneElement(currentStyle.icon, {
                className: "size-4",
              })}
            </div>
          )}
        </PickerTrigger>
        <PickerContent
          align={isMobile ? "center" : "start"}
          anchor={isMobile ? anchorRef : undefined}
          className="md:w-64"
          side={isMobile ? "top" : "right"}
        >
          <PickerRadioGroup
            onValueChange={handleValueChange}
            value={currentStyle?.name}
          >
            <PickerGroup>
              {styles.map((style, index) => (
                <React.Fragment key={style.name}>
                  <PickerRadioItem value={style.name}>
                    <div className="flex items-start gap-2">
                      {style.icon && (
                        <div className="flex size-4 translate-y-0.5 items-center justify-center">
                          {React.cloneElement(style.icon, {
                            className: "size-4",
                          })}
                        </div>
                      )}
                      <div className="flex flex-col justify-start pointer-coarse:gap-1">
                        <div>{style.title}</div>
                        <div className="pointer-coarse:text-sm text-site-muted-foreground text-xs">
                          {style.description}
                        </div>
                      </div>
                    </div>
                  </PickerRadioItem>
                  {index < styles.length - 1 && (
                    <PickerSeparator className="opacity-50" />
                  )}
                </React.Fragment>
              ))}
            </PickerGroup>
          </PickerRadioGroup>
        </PickerContent>
      </Picker>
      <LockButton
        className="-translate-y-1/2 absolute top-1/2 right-10"
        param="style"
      />
    </div>
  );
}
