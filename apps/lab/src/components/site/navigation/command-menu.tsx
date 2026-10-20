import {
  ArrowBendDownLeftIcon,
  CodeIcon,
  InfoIcon,
  PianoKeysIcon,
  SidebarIcon,
  SquaresFourIcon,
  SunIcon,
  XIcon,
} from "@phosphor-icons/react/ssr";
import { useHotkey } from "@tanstack/react-hotkeys";
import { useNavigate } from "@tanstack/react-router";
import { cn } from "cn";
import { useTheme } from "next-themes";
import { type ReactNode, useCallback, useState } from "react";
import { HotkeyKbd } from "@/components/site/hotkey-kbd";
import {
  FrameContent,
  FrameFooter,
  FrameHeader,
} from "@/components/site/layout/frame";
import { useLab } from "@/components/site/providers/lab-provider";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Kbd } from "@/components/ui/kbd";
import { Separator } from "@/components/ui/separator";
import { useSidebar } from "@/components/ui/sidebar";
import { DEVICES, groupByCategory } from "@/lib/devices";
import { HOTKEYS, type LabHotkey } from "@/lib/hotkeys";

type Kind = "action" | "device" | "page";

/** What kind of entry a highlighted value is. */
function kindOf(value: string): Kind {
  if (value.startsWith("device:")) {
    return "device";
  }
  return value.startsWith("page:") ? "page" : "action";
}

/** What Enter does on the highlighted entry, as the footer says it. */
const ENTER: Record<Kind, string> = {
  action: "Run action",
  device: "Open device",
  page: "Go to page",
};

const GROUP_CLASS =
  "p-0! **:[[cmdk-group-heading]]:p-3! **:[[cmdk-group-heading]]:pb-1!";
const ITEM_CLASS =
  "h-9 rounded-lg border border-transparent px-3! font-medium data-[selected=true]:border-input data-[selected=true]:bg-input/50";

/** Whether an entry matches what is typed, its keywords included: 1 or 0, as the list ranks. */
const matchesSearch = (value: string, search: string, keywords?: string[]) =>
  `${value} ${keywords?.join(" ") ?? ""}`
    .toLowerCase()
    .includes(search.toLowerCase())
    ? 1
    : 0;

/** An entry of the menu: an icon, its name, and the key it has elsewhere. */
function Entry({
  children,
  className,
  icon,
  keywords,
  onRun,
  hotkey,
  value,
}: {
  children: string;
  className?: string;
  icon: ReactNode;
  keywords?: string[];
  onRun: () => void;
  hotkey?: LabHotkey;
  value: string;
}) {
  return (
    <CommandItem
      className={cn(ITEM_CLASS, className)}
      keywords={keywords}
      onSelect={onRun}
      value={value}
    >
      {icon}
      <span className="min-w-0 flex-1 truncate">{children}</span>
      {hotkey ? <HotkeyKbd className="border" hotkey={hotkey} /> : null}
    </CommandItem>
  );
}

function DeviceEntry({
  keywords,
  onPick,
  slug,
  title,
}: {
  keywords: string[];
  onPick: (slug: string) => void;
  slug: string;
  title: string;
}) {
  const pick = useCallback(() => onPick(slug), [onPick, slug]);
  return (
    <Entry
      icon={<PianoKeysIcon weight="fill" />}
      keywords={keywords}
      onRun={pick}
      value={`device:${slug}`}
    >
      {title}
    </Entry>
  );
}

/** ⌘K or /: any device, and the frame's actions, from the keyboard. */
export function CommandMenu() {
  const { actions, state } = useLab();
  const { setCommandOpen, setSourceOpen, toggleDetails } = actions;
  const { toggleSidebar } = useSidebar();
  const { resolvedTheme, setTheme } = useTheme();
  const navigate = useNavigate();
  const [highlighted, setHighlighted] = useState("");

  const toggleMenu = useCallback(
    () => setCommandOpen(!state.commandOpen),
    [state.commandOpen, setCommandOpen]
  );
  useHotkey(HOTKEYS.search, toggleMenu);
  useHotkey(HOTKEYS.searchSlash, toggleMenu);

  const close = useCallback(() => setCommandOpen(false), [setCommandOpen]);
  const pick = useCallback(
    (slug: string) => {
      close();
      navigate({ params: { device: slug }, to: "/$device" });
    },
    [close, navigate]
  );
  const home = useCallback(() => {
    close();
    navigate({ to: "/" });
  }, [close, navigate]);
  const navigation = useCallback(() => {
    close();
    toggleSidebar();
  }, [close, toggleSidebar]);
  const details = useCallback(() => {
    close();
    toggleDetails();
  }, [close, toggleDetails]);
  const source = useCallback(() => {
    close();
    setSourceOpen(true);
  }, [close, setSourceOpen]);
  const theme = useCallback(() => {
    close();
    setTheme(resolvedTheme === "dark" ? "light" : "dark");
  }, [close, resolvedTheme, setTheme]);

  const kind = kindOf(highlighted);
  const link =
    kind === "device"
      ? `${typeof window === "undefined" ? "" : window.location.origin}/${highlighted.slice("device:".length)}`
      : "";

  // ⌘C on a device copies its link, as the docs copy a component's install command.
  const copyLink = useCallback(() => {
    if (!(state.commandOpen && link)) {
      return;
    }
    navigator.clipboard.writeText(link);
    close();
  }, [close, link, state.commandOpen]);
  // The copy of a selection in the search field stays the browser's own.
  useHotkey(HOTKEYS.copy, copyLink, {
    enabled: state.commandOpen && Boolean(link),
    preventDefault: false,
  });

  return (
    <Dialog onOpenChange={setCommandOpen} open={state.commandOpen}>
      <DialogContent
        className="flex max-h-[calc(100dvh-1.5rem)] flex-col gap-0 overflow-hidden rounded-xl border bg-[color-mix(in_oklab,var(--muted)_50%,var(--background))] p-0.5 shadow-2xl ring-0 max-sm:top-3 max-sm:h-[calc(100dvh-1.5rem)] max-sm:max-w-[calc(100%-1.5rem)] max-sm:translate-y-0 sm:max-w-xl **:data-[slot=command-item]:data-selected:bg-muted **:data-[slot=command-item]:max-sm:py-2.5 **:data-[slot=command]:bg-transparent"
        showCloseButton={false}
      >
        <DialogHeader className="sr-only">
          <DialogTitle>Search the lab</DialogTitle>
          <DialogDescription>
            Open a device, or run an action of the frame.
          </DialogDescription>
        </DialogHeader>
        <Command
          className="min-h-0 flex-1 gap-0 rounded-none! p-0"
          filter={matchesSearch}
          onValueChange={setHighlighted}
          value={highlighted}
        >
          <FrameHeader className="shrink-0 gap-1 p-1 **:data-[slot=command-input-wrapper]:flex-1 **:data-[slot=command-input-wrapper]:p-0">
            <CommandInput placeholder="Search…" />
            <DialogClose
              render={
                <Button
                  aria-label="Close search"
                  className="sm:hidden"
                  size="icon-sm"
                  variant="ghost"
                >
                  <XIcon aria-hidden weight="bold" />
                </Button>
              }
            />
          </FrameHeader>
          <FrameContent className="flex min-h-0 flex-1 flex-col p-1">
            <CommandList className="min-h-0 flex-1 max-sm:max-h-none sm:min-h-80 sm:flex-none">
              <CommandEmpty className="flex min-h-80 flex-col items-center justify-center gap-1 text-center">
                <p className="font-medium">No results found</p>
                <p className="text-muted-foreground text-sm">
                  Try another word, such as a device or a component.
                </p>
              </CommandEmpty>
              <CommandGroup className={GROUP_CLASS} heading="Pages">
                <Entry
                  icon={<SquaresFourIcon weight="fill" />}
                  keywords={["home", "gallery", "lab"]}
                  onRun={home}
                  value="page:home"
                >
                  All devices
                </Entry>
              </CommandGroup>
              {groupByCategory(DEVICES).map((group) => (
                <CommandGroup
                  className={GROUP_CLASS}
                  heading={group.category}
                  key={group.category}
                >
                  {group.devices.map((device) => (
                    <DeviceEntry
                      key={device.slug}
                      keywords={[
                        "device",
                        group.category,
                        device.title,
                        device.description,
                        ...device.uses,
                      ]}
                      onPick={pick}
                      slug={device.slug}
                      title={device.title}
                    />
                  ))}
                </CommandGroup>
              ))}
              <CommandGroup className={GROUP_CLASS} heading="Actions">
                <Entry
                  hotkey={HOTKEYS.navigation}
                  icon={<SidebarIcon weight="fill" />}
                  onRun={navigation}
                  value="action:navigation"
                >
                  Toggle navigation
                </Entry>
                <Entry
                  hotkey={HOTKEYS.details}
                  icon={<InfoIcon weight="fill" />}
                  onRun={details}
                  value="action:details"
                >
                  Toggle details
                </Entry>
                <Entry
                  hotkey={HOTKEYS.source}
                  icon={<CodeIcon weight="fill" />}
                  keywords={["code", "source"]}
                  onRun={source}
                  value="action:source"
                >
                  View the source
                </Entry>
                <Entry
                  hotkey={HOTKEYS.theme}
                  icon={<SunIcon weight="fill" />}
                  keywords={["dark", "light", "theme"]}
                  onRun={theme}
                  value="action:theme"
                >
                  Toggle theme
                </Entry>
              </CommandGroup>
            </CommandList>
          </FrameContent>
        </Command>
        <FrameFooter className="h-10 shrink-0 flex-row items-center gap-2 px-3 py-0 font-medium text-muted-foreground text-xs">
          <div className="flex shrink-0 items-center gap-2">
            <Kbd className="border">
              <ArrowBendDownLeftIcon weight="fill" />
            </Kbd>
            {ENTER[kind]}
          </div>
          {link ? (
            <>
              <Separator orientation="vertical" />
              <div className="flex min-w-0 flex-1 items-center gap-1">
                <HotkeyKbd className="border" hotkey={HOTKEYS.copy} />
                <span className="truncate">{link}</span>
              </div>
            </>
          ) : null}
        </FrameFooter>
      </DialogContent>
    </Dialog>
  );
}
