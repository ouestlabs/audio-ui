import { absoluteUrl as buildAbsoluteUrl } from "@/lib/seo/seo";

export { cn } from "cn";

const TRAILING_SLASH_REGEX = /\/$/;
const FILE_URL_REGEX = /\.[a-z0-9]+$/i;

/** An address that serves a file, such as `/llms.txt`: the server answers it, the client router has no page for it. */
export function isFileUrl(url: string) {
  return FILE_URL_REGEX.test(url);
}

export function isActive(pathname: string, href: string) {
  const normalizedPathname = pathname.replace(TRAILING_SLASH_REGEX, "");
  const normalizedHref = href.replace(TRAILING_SLASH_REGEX, "");
  return (
    normalizedPathname === normalizedHref ||
    (normalizedPathname.startsWith(normalizedHref) && normalizedHref !== "")
  );
}

export function absoluteUrl(path: string) {
  return buildAbsoluteUrl(path);
}

export function formatLabel(value: string): string {
  return value
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export function normalizeSlug(value: string): string {
  return value.toLowerCase().replace(/\s+/g, "-");
}
