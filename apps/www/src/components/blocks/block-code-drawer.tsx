import { BlockCodeDrawerActions } from "@/components/blocks/block-code-drawer-actions";
import { Command } from "@/components/md/code";
import { Source } from "@/components/md/preview";
import { Button } from "@/registry/default/ui/button";
import {
  Drawer,
  DrawerDescription,
  DrawerHeader,
  DrawerPanel,
  DrawerPopup,
  DrawerTitle,
  DrawerTrigger,
} from "@/registry/default/ui/drawer";

interface BlockCodeDrawerProps {
  name: string;
  filePath?: string;
  fileContent?: string;
}

export function BlockCodeDrawer({
  name,
  filePath,
  fileContent = "",
}: BlockCodeDrawerProps) {
  return (
    <Drawer position="right">
      <DrawerTrigger render={<Button size="sm" variant="outline" />}>
        View code
      </DrawerTrigger>
      <DrawerPopup
        className="max-w-2xl"
        position="right"
        showBar
        variant="straight"
      >
        <DrawerHeader allowSelection>
          <DrawerTitle>View code</DrawerTitle>
          <DrawerDescription>
            Install with the CLI, then browse the source below.
          </DrawerDescription>
          <Command
            __bun__={`bunx --bun shadcn@latest add @audio/${name}`}
            __npm__={`npx shadcn@latest add @audio/${name}`}
            __pnpm__={`pnpm dlx shadcn@latest add @audio/${name}`}
            __yarn__={`yarn dlx shadcn@latest add @audio/${name}`}
          />
        </DrawerHeader>
        <DrawerPanel
          className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden"
          scrollable={false}
          scrollFade={false}
        >
          <Source
            collapsible={false}
            copyButton={false}
            fillHeight
            headerActions={
              <BlockCodeDrawerActions code={fileContent} name={name} />
            }
            name={name}
            pathLabel={filePath}
          />
        </DrawerPanel>
      </DrawerPopup>
    </Drawer>
  );
}
