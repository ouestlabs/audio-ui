import { Command } from "@/components/md/code";

type InstallProps =
  | { component: string; pkg?: never; shadcn?: never }
  | { pkg: string; component?: never; shadcn?: never }
  | { shadcn: string; component?: never; pkg?: never };

const WHITESPACE = /\s+/;

function buildShadcnCommands(names: string[]) {
  const args = names.join(" ");
  return {
    __npm__: `npx shadcn@latest add ${args}`,
    __pnpm__: `pnpm dlx shadcn@latest add ${args}`,
    __yarn__: `yarn dlx shadcn@latest add ${args}`,
    __bun__: `bunx --bun shadcn@latest add ${args}`,
  };
}

function buildPackageCommands(pkgs: string[]) {
  const args = pkgs.join(" ");
  return {
    __npm__: `npm install ${args}`,
    __pnpm__: `pnpm add ${args}`,
    __yarn__: `yarn add ${args}`,
    __bun__: `bun add ${args}`,
  };
}

function Install({ component, pkg, shadcn }: InstallProps) {
  if (pkg) {
    return <Command {...buildPackageCommands(pkg.trim().split(WHITESPACE))} />;
  }
  if (component) {
    const names = component
      .trim()
      .split(WHITESPACE)
      .map((c) => `@audio/${c}`);
    return <Command {...buildShadcnCommands(names)} />;
  }
  return (
    <Command
      {...buildShadcnCommands((shadcn as string).trim().split(WHITESPACE))}
    />
  );
}

export { Install };
