/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { HugeiconsIcon, type IconSvgElement } from "@hugeicons/react";
import { use } from "react";

/** Each library's icons, a module of its own, loaded when one of them is first shown. */
const iconModules = import.meta.glob<Record<string, any>>("./__*__.ts");

const iconPromiseCaches = new Map<string, Map<string, Promise<any>>>();

function getCache(libraryName: string) {
  let cache = iconPromiseCaches.get(libraryName);
  if (!cache) {
    cache = new Map();
    iconPromiseCaches.set(libraryName, cache);
  }
  return cache;
}

function isIconData(data: any): data is IconSvgElement {
  return Array.isArray(data);
}

export function createIconLoader(libraryName: string) {
  const cache = getCache(libraryName);

  return function IconLoader({
    name,
    strokeWidth = 2,
    ...props
  }: {
    name: string;
  } & React.ComponentProps<"svg">) {
    let promise = cache.get(name);
    if (!promise) {
      const load = iconModules[`./__${libraryName}__.ts`];
      promise = (load ? load() : Promise.resolve({})).then((mod) => {
        const icon = mod[name as keyof typeof mod];
        return icon || null;
      });
      cache.set(name, promise);
    }

    const iconData = use(promise);

    if (!iconData) {
      return null;
    }

    if (isIconData(iconData)) {
      return <HugeiconsIcon icon={iconData} strokeWidth={2} {...props} />;
    }

    const IconComponent = iconData;
    return <IconComponent {...props} />;
  };
}
