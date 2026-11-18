import * as React from "react";
import { DesignSystemContext } from "@/components/customizer/design-system-provider";
import {
  Picker,
  PickerContent,
  PickerGroup,
  PickerRadioGroup,
  PickerRadioItem,
  PickerTrigger,
  usePickerSide,
} from "@/components/customizer/pickers/picker";
import { useConfig } from "@/hooks/use-config";
import { useMounted } from "@/hooks/use-mounted";
import { useDesignSystemSearchParams } from "@/lib/design-system/search-params";
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
      base: params.base ?? config.base,
      baseColor: context?.baseColor ?? params.baseColor ?? config.baseColor,
      font: context?.font ?? params.font ?? config.font,
      iconLibrary:
        context?.iconLibrary ?? params.iconLibrary ?? config.iconLibrary,
      menuAccent: context?.menuAccent ?? params.menuAccent ?? config.menuAccent,
      menuColor: context?.menuColor ?? params.menuColor ?? config.menuColor,
      radius: context?.radius ?? params.radius ?? config.radius,
      style: context?.style ?? params.style ?? config.style,
      theme: context?.theme ?? params.theme ?? config.theme,
    }),
    [context, params, config]
  );

  const currentPreset = React.useMemo(() => {
    if (!mounted) {
      return null;
    }
    return presets.find(
      (preset) =>
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
    effectiveParams.style,
    effectiveParams.baseColor,
    effectiveParams.theme,
    effectiveParams.iconLibrary,
    effectiveParams.font,
    effectiveParams.menuAccent,
    effectiveParams.menuColor,
    effectiveParams.radius,
  ]);

  // A preset is a look, for every base.
  const currentBasePresets = presets;

  const handlePresetChange = React.useCallback(
    (value: string) => {
      const preset = presets.find((p) => p.title === value);
      if (!preset) {
        return;
      }

      const newValues = {
        baseColor: preset.baseColor,
        custom: false,
        font: preset.font,
        iconLibrary: preset.iconLibrary,
        menuAccent: preset.menuAccent,
        menuColor: preset.menuColor,
        radius: preset.radius,
        style: preset.style,
        theme: preset.theme,
      };

      // Update all params including base.
      setParams(newValues);
      setConfig((prev) => ({ ...prev, ...newValues }));
    },
    [presets, setConfig, setParams]
  );

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
        side={usePickerSide(isMobile)}
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
                    {style?.icon ? (
                      <div className="flex size-4 shrink-0 items-center justify-center">
                        {React.cloneElement(style.icon, {
                          className: "size-4",
                        })}
                      </div>
                    ) : null}
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
