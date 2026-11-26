import * as React from "react";
import { CopyCss } from "@/components/customizer/actions/copy-css";
import { CopyPreset } from "@/components/customizer/actions/copy-preset";
import { OpenPreset } from "@/components/customizer/actions/open-preset";
import { RandomButton } from "@/components/customizer/actions/random-button";
import { ResetButton } from "@/components/customizer/actions/reset-button";
import {
  AxisPicker,
  SkinPicker,
} from "@/components/customizer/look/look-pickers";
import { MenuAccentPicker } from "@/components/customizer/pickers/accent-picker";
import { BaseColorPicker } from "@/components/customizer/pickers/base-color-picker";
import { BasePicker } from "@/components/customizer/pickers/base-picker";
import { ChartColorPicker } from "@/components/customizer/pickers/chart-color-picker";
import { FontPicker } from "@/components/customizer/pickers/font-picker";
import { IconLibraryPicker } from "@/components/customizer/pickers/icon-library-picker";
import {
  DensityPicker,
  SizePicker,
} from "@/components/customizer/pickers/look-pickers";
import { MenuColorPicker } from "@/components/customizer/pickers/menu-picker";
import { RadiusPicker } from "@/components/customizer/pickers/radius-picker";
import { StylePicker } from "@/components/customizer/pickers/style-picker";
import { StylingPicker } from "@/components/customizer/pickers/styling-picker";
import { ThemePicker } from "@/components/customizer/pickers/theme-picker";
import { FieldGroup } from "@/components/ui/field";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useConfig } from "@/hooks/use-config";
import { useCustomizerScope } from "@/hooks/use-customizer-scope";
import { useSkin } from "@/hooks/use-skin";
import { ELEMENT_CHOICES } from "@/lib/design-system/customizer-scope";
import { FONT_HEADING_OPTIONS, FONTS } from "@/lib/design-system/fonts";
import { AXIS_ORDER } from "@/lib/design-system/look";
import { useDesignSystemSearchParams } from "@/lib/design-system/search-params";
import { getThemesForBaseColor, STYLES } from "@/registry/config";

interface CustomizerSidebarContentProps {
  anchorRef: React.RefObject<HTMLDivElement | null>;
  isMobile: boolean;
  /** `list` stacks the choices down a column; `strip` lays them in one row to swipe along, for a short panel. */
  layout?: "list" | "strip";
}

export function CustomizerSidebarContent({
  isMobile,
  anchorRef,
  layout = "list",
}: CustomizerSidebarContentProps) {
  const [params] = useDesignSystemSearchParams();
  const [config] = useConfig();

  const effectiveBaseColor = params.baseColor ?? config.baseColor;

  const availableThemes = React.useMemo(
    () => getThemesForBaseColor(effectiveBaseColor),
    [effectiveBaseColor]
  );

  const strip = layout === "strip";
  const [skin] = useSkin();
  // The skin and, for a skin of material, the axes it is made of: Digital has none.
  const look = (
    <>
      <SkinPicker anchorRef={anchorRef} isMobile={isMobile} />
      {skin === "digital"
        ? null
        : AXIS_ORDER.map((axis) => (
            <AxisPicker
              anchorRef={anchorRef}
              axis={axis}
              isMobile={isMobile}
              key={axis}
            />
          ))}
    </>
  );
  // On a page of the custom elements: how the examples are styled and their look, with the theme as CSS for the output.
  const forElements = useCustomizerScope() === "elements";
  const pickers = forElements ? (
    <>
      <StylingPicker anchorRef={anchorRef} isMobile={isMobile} />
      <ThemePicker
        anchorRef={anchorRef}
        isMobile={isMobile}
        label="Accent"
        themes={availableThemes}
      />
      <RadiusPicker
        anchorRef={anchorRef}
        defaultNote="0.625rem, the theme's"
        isMobile={isMobile}
      />
      <SizePicker anchorRef={anchorRef} isMobile={isMobile} />
      <DensityPicker anchorRef={anchorRef} isMobile={isMobile} />
    </>
  ) : (
    <>
      <BasePicker anchorRef={anchorRef} isMobile={isMobile} />
      <StylePicker anchorRef={anchorRef} isMobile={isMobile} styles={STYLES} />
      <BaseColorPicker anchorRef={anchorRef} isMobile={isMobile} />
      <ThemePicker
        anchorRef={anchorRef}
        isMobile={isMobile}
        themes={availableThemes}
      />
      <ChartColorPicker anchorRef={anchorRef} isMobile={isMobile} />
      <IconLibraryPicker anchorRef={anchorRef} isMobile={isMobile} />
      <FontPicker
        anchorRef={anchorRef}
        fonts={FONT_HEADING_OPTIONS}
        isMobile={isMobile}
        label="Heading"
        param="fontHeading"
      />
      <FontPicker
        anchorRef={anchorRef}
        fonts={FONTS}
        isMobile={isMobile}
        label="Font"
        param="font"
      />
      <RadiusPicker anchorRef={anchorRef} isMobile={isMobile} />
      <MenuColorPicker anchorRef={anchorRef} isMobile={isMobile} />
      <MenuAccentPicker anchorRef={anchorRef} isMobile={isMobile} />
    </>
  );
  const actions = forElements ? (
    <>
      <CopyCss />
      <RandomButton choices={ELEMENT_CHOICES} />
      <ResetButton />
    </>
  ) : (
    <>
      <CopyPreset />
      <OpenPreset />
      <RandomButton />
      <ResetButton />
    </>
  );

  return (
    <>
      <div
        className={
          strip
            ? "no-scrollbar scroll-fade-x snap-x overflow-x-auto overflow-y-hidden overscroll-x-contain"
            : "scroll-fade-y no-scrollbar min-h-0 flex-1 overflow-y-auto"
        }
      >
        {strip ? (
          <div className="flex w-max flex-row gap-2 p-2">
            {look}
            {pickers}
            {actions}
          </div>
        ) : (
          <Tabs className="p-2" defaultValue="look">
            <TabsList className="w-full">
              <TabsTrigger value="look">Look</TabsTrigger>
              <TabsTrigger value="component">Component</TabsTrigger>
            </TabsList>
            <TabsContent value="look">
              <FieldGroup className="flex flex-col gap-0">
                {look}
                <p className="px-2.5 pt-4 pb-1 font-medium text-site-muted-foreground text-xs">
                  Design system
                </p>
                {pickers}
              </FieldGroup>
            </TabsContent>
            <TabsContent value="component">
              <p className="p-3 text-site-muted-foreground text-sm">
                The props of a component, on its page.
              </p>
            </TabsContent>
          </Tabs>
        )}
      </div>
      {!strip && (
        <div className="mt-auto flex shrink-0 flex-col gap-0 p-3">
          {actions}
        </div>
      )}
    </>
  );
}
