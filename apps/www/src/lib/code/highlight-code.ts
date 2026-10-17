export type PackageManagerCommands = {
  bun: string;
  npm: string;
  pnpm: string;
  yarn: string;
};

/** An npm command in the other package managers' words, or `null` if it is not one. */
export function packageManagerCommands(
  raw: string
): PackageManagerCommands | null {
  if (raw.startsWith("npm install")) {
    return {
      bun: raw.replace("npm install", "bun add"),
      npm: raw,
      pnpm: raw.replace("npm install", "pnpm add"),
      yarn: raw.replace("npm install", "yarn add"),
    };
  }
  if (raw.startsWith("npx create-")) {
    return {
      bun: raw.replace("npx", "bunx --bun"),
      npm: raw,
      pnpm: raw.replace("npx create-", "pnpm create "),
      yarn: raw.replace("npx create-", "yarn create "),
    };
  }
  if (raw.startsWith("npm create")) {
    return {
      bun: raw.replace("npm create", "bun create"),
      npm: raw,
      pnpm: raw.replace("npm create", "pnpm create"),
      yarn: raw.replace("npm create", "yarn create"),
    };
  }
  if (raw.startsWith("npx")) {
    return {
      bun: raw.replace("npx", "bunx --bun"),
      npm: raw,
      pnpm: raw.replace("npx", "pnpm dlx"),
      yarn: raw.replace("npx", "yarn"),
    };
  }
  if (raw.startsWith("npm run")) {
    return {
      bun: raw.replace("npm run", "bun"),
      npm: raw,
      pnpm: raw.replace("npm run", "pnpm"),
      yarn: raw.replace("npm run", "yarn"),
    };
  }
  return null;
}
