import { TerminalIcon } from "@phosphor-icons/react/ssr";
import * as React from "react";
import { CopyButton } from "@/components/code/copy/copy-button";
import { Icons } from "@/components/site/icons";
import {
  Frame,
  FrameContent,
  FrameHeader,
} from "@/components/site/layout/frame";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { type Config, DEFAULT_CONFIG, useConfig } from "@/hooks/use-config";
import { useMounted } from "@/hooks/use-mounted";

type PackageManager = Config["packageManager"];

export function CodeBlockCommand({
  __npm__,
  __yarn__,
  __pnpm__,
  __bun__,
}: React.ComponentProps<"pre"> & {
  __npm__?: string;
  __yarn__?: string;
  __pnpm__?: string;
  __bun__?: string;
}) {
  const [config, setConfig] = useConfig();
  const mounted = useMounted();

  const packageManager = mounted
    ? (config.packageManager ?? DEFAULT_CONFIG.packageManager)
    : DEFAULT_CONFIG.packageManager;

  const commands = React.useMemo(
    () => ({
      bun: __bun__,
      npm: __npm__,
      pnpm: __pnpm__,
      yarn: __yarn__,
    }),
    [__npm__, __pnpm__, __yarn__, __bun__]
  );

  const command = commands[packageManager] ?? "";
  const handlePackageManagerChange = React.useCallback(
    (value: PackageManager | null) => {
      if (value) {
        setConfig({ ...config, packageManager: value });
      }
    },
    [config, setConfig]
  );

  return (
    // The frame of the site: the package manager chosen in its header, its command in the panel.
    <Frame className="not-typeset" data-code-command="">
      <FrameHeader className="min-h-11 flex-row items-center justify-between gap-3 px-2 py-1.5">
        <div className="flex items-center gap-2 ps-1">
          <TerminalIcon
            aria-hidden="true"
            className="size-4 text-site-muted-foreground"
            weight="fill"
          />
          <Select
            onValueChange={handlePackageManagerChange}
            value={packageManager}
          >
            <SelectTrigger aria-label="Package manager">
              <SelectValue>
                {(value: PackageManager) => {
                  const Icon = Icons[value];
                  return (
                    <>
                      <Icon aria-hidden="true" className="size-3.5" />
                      {value}
                    </>
                  );
                }}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {(Object.keys(commands) as PackageManager[]).map((key) => {
                  const Icon = Icons[key];
                  return (
                    <SelectItem key={key} value={key}>
                      <Icon aria-hidden="true" className="size-3.5" />
                      {key}
                    </SelectItem>
                  );
                })}
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>
        <CopyButton
          className="relative"
          event="copy_command"
          properties={{
            base: config.base,
            command,
            iconLibrary: config.iconLibrary,
            pm: packageManager,
            style: config.style,
          }}
          style={{ right: "auto", top: "auto" }}
          value={command}
          variant="outline"
        />
      </FrameHeader>
      <FrameContent className="no-scrollbar scroll-fade-x overflow-x-auto">
        <div className="px-4 py-3.5">
          <pre>
            <code
              className="relative mr-4 font-mono text-sm leading-none"
              data-language="bash"
            >
              {command}
            </code>
          </pre>
        </div>
      </FrameContent>
    </Frame>
  );
}
