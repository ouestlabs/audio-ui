"use client";

import {
  ArrowUpRightIcon,
  ChevronDownIcon,
  ExternalLinkIcon,
} from "lucide-react";
import Link from "next/link";
import { Icons } from "@/lib/icons";
import { Button } from "@/registry/default/ui/button";
import {
  ButtonGroup,
  ButtonGroupText,
} from "@/registry/default/ui/button-group";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/registry/default/ui/dropdown-menu";

type LinkItem = {
  label: string;
  url: string;
  icon?: React.ReactNode;
};

type LinkValue = string | string[] | undefined;

type DocLinksProps = {
  links?: {
    doc?: LinkValue;
    api?: LinkValue;
  };
};

function normalizeLinkValue(value: LinkValue): string[] {
  if (!value) {
    return [];
  }
  return Array.isArray(value) ? value : [value];
}

function getIconFromUrl(url: string): React.ReactNode {
  try {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname.toLowerCase();

    if (hostname.includes("shadcn.com")) {
      return <Icons.shadcn className="size-4 shrink-0" />;
    }
    if (hostname.includes("radix-ui.com") || hostname.includes("radix")) {
      return <Icons.radix className="size-4 shrink-0" />;
    }
    if (hostname.includes("github.com")) {
      return <Icons.github className="size-4 shrink-0" />;
    }
    if (hostname.includes("docs.dndkit.com") || hostname.includes("dndkit")) {
      return <Icons.react className="size-4 shrink-0" />;
    }
    if (
      hostname.includes("zustand.docs.pmnd.rs") ||
      hostname.includes("zustand")
    ) {
      return <Icons.react className="size-4 shrink-0" />;
    }

    return <ExternalLinkIcon className="size-4 shrink-0" />;
  } catch {
    return <ExternalLinkIcon className="size-4 shrink-0" />;
  }
}

function extractLabelFromUrl(url: string): string {
  try {
    const urlObj = new URL(url);
    const pathParts = urlObj.pathname.split("/").filter(Boolean);

    if (urlObj.hostname.includes("shadcn.com")) {
      const componentName = pathParts.at(-1);
      if (componentName) {
        return componentName
          .split("-")
          .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
          .join("");
      }
    }

    const lastPart = pathParts.at(-1);
    if (lastPart) {
      return lastPart
        .split("-")
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(" ");
    }

    return "Link";
  } catch {
    return "Link";
  }
}

function addLinkItems(
  menuItems: LinkItem[],
  urls: string[],
  baseLabel: string
): void {
  for (const url of urls) {
    if (url) {
      const label = urls.length > 1 ? extractLabelFromUrl(url) : baseLabel;
      menuItems.push({
        label,
        url,
        icon: getIconFromUrl(url),
      });
    }
  }
}

function buildMenuItems(links: DocLinksProps["links"]): LinkItem[] {
  if (!links) {
    return [];
  }

  const menuItems: LinkItem[] = [];
  const docLinks = normalizeLinkValue(links.doc);
  const apiLinks = normalizeLinkValue(links.api);

  addLinkItems(menuItems, docLinks, "Documentation");
  addLinkItems(menuItems, apiLinks, "API Reference");

  return menuItems;
}

function getGroupLabel(links: DocLinksProps["links"]): string {
  if (!links) {
    return "Links";
  }

  const hasDoc = links.doc && normalizeLinkValue(links.doc).length > 0;
  const hasApi = links.api && normalizeLinkValue(links.api).length > 0;

  if (hasDoc && hasApi) {
    return "References";
  }
  if (hasDoc) {
    return "Documentation";
  }
  if (hasApi) {
    return "API Reference";
  }

  return "Links";
}

export function DocsLinks({ links }: DocLinksProps) {
  const menuItems = buildMenuItems(links);

  if (menuItems.length === 0) {
    return null;
  }

  if (menuItems.length === 1) {
    const firstItem = menuItems[0];
    if (!firstItem) {
      return null;
    }

    return (
      <Button asChild size="sm" variant="outline">
        <Link href={firstItem.url} rel="noreferrer" target="_blank">
          <ArrowUpRightIcon className="size-4" />
          {firstItem.label}
        </Link>
      </Button>
    );
  }

  const groupLabel = getGroupLabel(links);

  return (
    <ButtonGroup className="relative">
      <ButtonGroupText>{groupLabel}</ButtonGroupText>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button size="sm" variant="outline">
            <ChevronDownIcon />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="end"
          className="min-w-(--dropdown-menu-width)"
        >
          {menuItems.map((item) => (
            <DropdownMenuItem asChild key={item.url}>
              <Link
                className="flex items-center gap-2"
                href={item.url}
                rel="noreferrer"
                target="_blank"
              >
                {item.icon && (
                  <span className="flex shrink-0">{item.icon}</span>
                )}
                {item.label}
              </Link>
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </ButtonGroup>
  );
}
