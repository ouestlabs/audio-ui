"use client";

import { CopyIcon } from "lucide-react";
import React from "react";
import { useThemeConfig } from "@/components/theme/active";
import { CustomizerCode } from "@/components/theme/customizer-code";
import { THEMES } from "@/lib/themes";
import { cn } from "@/registry/default/lib/utils";
import { Button } from "@/registry/default/ui/button";
import {
  ButtonGroup,
  ButtonGroupText,
} from "@/registry/default/ui/button-group";
import {
  Drawer,
  DrawerDescription,
  DrawerHeader,
  DrawerPanel,
  DrawerPopup,
  DrawerTitle,
  DrawerTrigger,
} from "@/registry/default/ui/drawer";
import { Label } from "@/registry/default/ui/label";
import { ScrollArea, ScrollBar } from "@/registry/default/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/registry/default/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/registry/default/ui/tabs";

export function ThemeCustomizer({ className }: React.ComponentProps<"div">) {
  const { activeTheme = "neutral", setActiveTheme } = useThemeConfig();

  return (
    <div className={cn("flex w-full items-center gap-2", className)}>
      <ScrollArea className="hidden max-w-[96%] md:max-w-[600px] lg:flex lg:max-w-none">
        <div className="flex items-center gap-0.5">
          {THEMES.map((theme) => (
            <Button
              className="h-8 rounded-lg px-3 font-medium text-muted-foreground text-sm capitalize transition-colors hover:bg-muted/60 hover:text-foreground data-[active=true]:bg-muted data-[active=true]:text-foreground"
              data-active={activeTheme === theme.name}
              key={theme.name}
              onClick={() => setActiveTheme(theme.name)}
              size="sm"
              variant="ghost"
            >
              {theme.name === "neutral" ? "Default" : theme.name}
            </Button>
          ))}
        </div>
        <ScrollBar className="invisible" orientation="horizontal" />
      </ScrollArea>
      <div className="flex min-w-0 flex-1 items-center gap-2 lg:hidden">
        <Label className="sr-only" htmlFor="theme-selector">
          Theme
        </Label>
        <ButtonGroup>
          <ButtonGroupText>Theme</ButtonGroupText>
          <Select
            onValueChange={(value) => {
              if (value) {
                setActiveTheme(value);
              }
            }}
            value={activeTheme === "default" ? "neutral" : activeTheme}
          >
            <SelectTrigger id="theme-selector" size="sm">
              <SelectValue placeholder="Select a theme" />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {THEMES.map((theme) => (
                  <SelectItem key={theme.name} value={theme.name}>
                    {theme.name}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </ButtonGroup>
      </div>
      <CopyCodeButton className="ml-auto" size="sm" variant="secondary" />
    </div>
  );
}

export function CopyCodeButton({
  className,
  variant = "default",
  size = "default",
  render: _render,
  ...rest
}: React.ComponentProps<typeof Button>) {
  let { activeTheme: activeThemeName = "neutral" } = useThemeConfig();
  activeThemeName = activeThemeName === "default" ? "neutral" : activeThemeName;
  const [open, setOpen] = React.useState(false);
  const [tailwindVersion, setTailwindVersion] = React.useState("v4-oklch");

  return (
    <Drawer onOpenChange={setOpen} open={open} position="right">
      <DrawerTrigger
        render={
          <Button
            className={cn("group/button", className)}
            data-size={size}
            size={size}
            variant={variant}
            {...rest}
          />
        }
      >
        <CopyIcon />
        <span className="group-data-[size=icon-sm]/button:sr-only">
          Copy Code
        </span>
      </DrawerTrigger>
      <DrawerPopup
        className="max-w-2xl"
        position="right"
        showBar
        variant="straight"
      >
        <Tabs
          className="flex min-h-0 flex-1 flex-col"
          onValueChange={setTailwindVersion}
          value={tailwindVersion}
        >
          <DrawerHeader allowSelection>
            <DrawerTitle className="capitalize">{activeThemeName}</DrawerTitle>
            <DrawerDescription>
              Copy into your global CSS — pick a format below.
            </DrawerDescription>
            <TabsList className="w-full">
              <TabsTrigger value="v4-oklch">OKLCH</TabsTrigger>
              <TabsTrigger value="v4-hsl">HSL</TabsTrigger>
              <TabsTrigger value="v3">Tailwind v3</TabsTrigger>
            </TabsList>
          </DrawerHeader>
          <DrawerPanel
            className="flex min-h-0 flex-1 flex-col"
            scrollable={false}
            scrollFade={false}
          >
            <CustomizerCode themeName={activeThemeName} />
          </DrawerPanel>
        </Tabs>
      </DrawerPopup>
    </Drawer>
  );
}
