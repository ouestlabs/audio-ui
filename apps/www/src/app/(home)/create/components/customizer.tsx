"use client";

import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
} from "@/registry/default/ui/card";
import { FieldGroup, FieldSeparator } from "@/registry/default/ui/field";
import { LocksProvider } from "../hooks/use-locks";
import { MenuAccentPicker } from "./accent-picker";
import { BaseColorPicker } from "./base-color-picker";
import { CopyPreset } from "./copy-preset";
import { FontPicker } from "./font-picker";
import { GetCode } from "./get-code";
import { IconLibraryPicker } from "./icon-library-picker";
import { MainMenu } from "./main-menu";
import { MenuColorPicker } from "./menu-picker";
import { RadiusPicker } from "./radius-picker";
import { RandomButton } from "./random-button";
import { StylePicker } from "./style-picker";
import { ThemePicker } from "./theme-picker";

export function Customizer() {
  return (
    <LocksProvider>
      <Card
        className="dark top-24 right-12 isolate z-10 max-h-full min-h-0 w-full self-start rounded-2xl bg-card/90 backdrop-blur-xl md:w-(--customizer-width)"
        size="sm"
      >
        <CardHeader className="hidden items-center justify-between gap-2 border-b group-data-reversed/layout:flex-row-reverse md:flex">
          <MainMenu />
        </CardHeader>

        <CardContent className="no-scrollbar min-h-0 flex-1 overflow-x-auto overflow-y-hidden md:overflow-y-auto">
          <FieldGroup className="**:data-[slot=field-separator]:-mx-4 flex-row gap-2.5 py-px **:data-[slot=field-separator]:w-auto md:flex-col md:gap-3.25">
            <StylePicker />
            <FieldSeparator className="hidden md:block" />
            <BaseColorPicker />
            <ThemePicker />
            <FieldSeparator className="hidden md:block" />
            <RadiusPicker />
            <FontPicker label="Heading" param="fontHeading" />
            <FontPicker label="Font" param="font" />
            <IconLibraryPicker />
            <FieldSeparator className="hidden md:block" />
            <MenuColorPicker />
            <MenuAccentPicker />
          </FieldGroup>
        </CardContent>
        <CardFooter className="flex min-w-0 gap-2 md:flex-col md:rounded-b-none! md:**:[button,a]:w-full">
          <CopyPreset />
          <RandomButton />
          <GetCode />
        </CardFooter>
      </Card>
    </LocksProvider>
  );
}
