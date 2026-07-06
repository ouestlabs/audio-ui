"use client";

import * as React from "react";
import { DesignSystemContext } from "@/app/(create)/customizer/design-system-provider";
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
import { type Preset, STYLES } from "@/registry/config";

export function PresetPicker({
  presets,
  isMobile,
  anchorRef,
}: {
  presets: readonly Preset[];
  isMobile: boolean;
  anchorRef: React.RefObject<HTMLDivElement | null>;
}) {
  const mounted = useMounted();
  const context = React.use(DesignSystemContext);
  const [params, setParams] = useDesignSystemSearchParams();
  const [config, setConfig] = useConfig();

  const effectiveParams = React.useMemo(
    () => ({
      base: context?.style?.split("-")[0] ?? params.base ?? config.base,
      style: context?.style ?? params.style ?? config.style,
      baseColor: context?.baseColor ?? params.baseColor ?? config.baseColor,
      theme: context?.theme ?? params.theme ?? config.theme,
      iconLibrary:
        context?.iconLibrary ?? params.iconLibrary ?? config.iconLibrary,
      font: context?.font ?? params.font ?? config.font,
      menuAccent: context?.menuAccent ?? params.menuAccent ?? config.menuAccent,
      menuColor: context?.menuColor ?? params.menuColor ?? config.menuColor,
      radius: context?.radius ?? params.radius ?? config.radius,
    }),
    [context, params, config]
  );

  const currentPreset = React.useMemo(() => {
    if (!mounted) {
      return null;
    }
    return presets.find(
      (preset) =>
        preset.base === effectiveParams.base &&
        preset.style === effectiveParams.style &&
        preset.baseColor === effectiveParams.baseColor &&
        preset.theme === effectiveParams.theme &&
        preset.iconLibrary === effectiveParams.iconLibrary &&
        preset.font === effectiveParams.font &&
        preset.menuAccent === effectiveParams.menuAccent &&
        preset.menuColor === effectiveParams.menuColor &&
        preset.radius === effectiveParams.radius
    );
  }, [
    mounted,
    presets,
    effectiveParams.base,
    effectiveParams.style,
    effectiveParams.baseColor,
    effectiveParams.theme,
    effectiveParams.iconLibrary,
    effectiveParams.font,
    effectiveParams.menuAccent,
    effectiveParams.menuColor,
    effectiveParams.radius,
  ]);

  // Filter presets for current base only
  const currentBasePresets = React.useMemo(
    () => presets.filter((preset) => preset.base === effectiveParams.base),
    [presets, effectiveParams.base]
  );

  const handlePresetChange = (value: string) => {
    const preset = presets.find((p) => p.title === value);
    if (!preset) {
      return;
    }

    const newValues = {
      base: preset.base,
      style: preset.style,
      baseColor: preset.baseColor,
      theme: preset.theme,
      iconLibrary: preset.iconLibrary,
      font: preset.font,
      menuAccent: preset.menuAccent,
      menuColor: preset.menuColor,
      radius: preset.radius,
      custom: false,
    };

    // Update all params including base.
    setParams(newValues);
    setConfig((prev) => ({ ...prev, ...newValues }));
  };

  return (
    <Picker>
      <PickerTrigger>
        <div className="flex flex-col justify-start text-left">
          <div className="text-site-muted-foreground text-xs">Preset</div>
          <div className="line-clamp-1 font-medium text-site-foreground text-sm">
            {mounted ? (currentPreset?.description ?? "Custom") : "..."}
          </div>
        </div>
      </PickerTrigger>
      <PickerContent
        align={isMobile ? "center" : "start"}
        anchor={isMobile ? anchorRef : undefined}
        className="md:w-72"
        side={isMobile ? "top" : "right"}
      >
        <PickerRadioGroup
          onValueChange={handlePresetChange}
          value={currentPreset?.title ?? ""}
        >
          <PickerGroup>
            {currentBasePresets.map((preset) => {
              const style = STYLES.find((s) => s.name === preset.style);
              return (
                <PickerRadioItem key={preset.title} value={preset.title}>
                  <div className="flex items-center gap-2">
                    {style?.icon && (
                      <div className="flex size-4 shrink-0 items-center justify-center">
                        {React.cloneElement(style.icon, {
                          className: "size-4",
                        })}
                      </div>
                    )}
                    {preset.description}
                  </div>
                </PickerRadioItem>
              );
            })}
          </PickerGroup>
        </PickerRadioGroup>
      </PickerContent>
    </Picker>
  );
}
