/**
 * Registry - Client-safe registry operations
 *
 * This module provides client-safe access to registry data.
 * For server-only API functions, use @/lib/registry-server instead.
 *
 * Performance optimization:
 * - Categories are loaded from registry.json (small JSON manifest)
 * - Component category SEO copy is in seo.json (lazy-loaded in helpers)
 * - Metadata is loaded per-base from base/registry.ts
 * - Components are lazy-loaded on-demand
 */

import * as React from "react";
import { audio } from "../../../registry-audio/bases/base/audio/_registry";
import { components } from "../../../registry-audio/bases/base/components/_registry";
import { lib } from "../../../registry-audio/bases/base/lib/_registry";
import componentsManifest from "../../../registry-audio/bases/components.json";
import registryStats from "../../../registry-audio/bases/registry.json";
import registrySeo from "../../../registry-audio/bases/seo.json";

const WHITESPACE_REGEX = /\s+/;

function normalizeRegistrySlug(value: string) {
  return value.toLowerCase().replace(/\s+/g, "-");
}

/**
 * Client and server must use the same deployment-scoped registry URL so a new
 * deploy gets a new cache key without turning /r/styles into a function.
 */
export function getRegistryDeploymentId(): string {
  return import.meta.env.VITE_DEPLOYMENT_ID ?? "local";
}

export function getRegistryJsonUrl(styleName: string, name: string): string {
  const path = `/r/styles/${styleName}/${encodeURIComponent(name)}.json`;
  return `${path}?v=${encodeURIComponent(getRegistryDeploymentId())}`;
}

export function getRegistryJsonAbsoluteUrl(
  origin: string,
  styleName: string,
  name: string
): string {
  const normalizedOrigin = origin.endsWith("/") ? origin : `${origin}/`;
  return new URL(
    getRegistryJsonUrl(styleName, name),
    normalizedOrigin
  ).toString();
}

// ============================================================================
// Types
// ============================================================================

export interface CategorySeoInfo {
  content?: CategorySeoContent;
  /** Optional; use `{{count}}` (or legacy `[[count]]`) for the live component count from `registry.json` (same as `intro`). */
  description?: string;
  docsDescription?: string;
  highlights?: string[];
  /** Use `{{count}}` where the live component count from registry should appear (replaced at runtime). */
  intro?: string;
  keywords?: string[];
  relatedComponents?: RelatedComponentsBlock;
  title?: string;
}

/** Title + inline description (features list) */
export interface CategorySeoFeatureItem {
  description: string;
  title: string;
}

export interface CategorySeoComponentListItem {
  badge?: string;
  description: string;
  href: string;
  slug: string;
  title: string;
}

export interface CategorySeoSection {
  bullets?: string[];
  /** Rich cards linking to component category pages (catalog index SEO) */
  componentList?: CategorySeoComponentListItem[];
  /** Structured features: bold title + description on one line each */
  featureItems?: CategorySeoFeatureItem[];
  /** Lead-in paragraph before structured lists (e.g. catalog index "Popular Components") */
  intro?: string;
  paragraphs?: string[];
  title: string;
}

export interface CategorySeoFaq {
  answer: string;
  question: string;
}

export interface CategorySeoContent {
  faqs?: CategorySeoFaq[];
  sections: CategorySeoSection[];
  summary: string[];
  title: string;
}

export interface RelatedComponentRef {
  label: string;
  slug: string;
}

/**
 * Integration block: prose with `[[slug|Label]]` links.
 * Use **Shadcn {Name}** in the visible label (e.g. `[[button|Shadcn Button]]`, `[[alert-dialog|Shadcn Alert Dialog]]`).
 */
export interface RelatedComponentsBlock {
  /** 2–3 paragraphs; `[[slug|Label]]` renders as internal links */
  integrationBody?: string[];
  /** Optional reference list for authors only; not rendered on the page */
  items?: RelatedComponentRef[];
  /** Component catalog index: internal links to `/components/{slug}` */
  links?: RelatedComponentRef[];
  /** e.g. "Integrating With Other Components" (Title Case) */
  title: string;
}

export interface CategoryInfo {
  count: number;
  description: string;
  label: string;
  name: string;
}

export interface ComponentCategorySeo {
  content?: CategorySeoContent;
  description: string;
  /** @deprecated Category pages no longer surface highlight chips; kept optional for compatibility */
  highlights?: string[];
  intro: string;
  keywords: string[];
  relatedComponents?: RelatedComponentsBlock;
  title: string;
}

export interface ComponentCatalogItem {
  categories: string[];
  description: string | undefined;
  meta:
    | {
        className?: string;
        colSpan?: number;
        gridSize?: 1 | 2;
        order?: number;
      }
    | undefined;
  name: string;
  primaryCategory: string;
  searchText: string;
  title: string;
}

interface RegistryItemFile {
  content?: string;
  highlightedContent?: string;
  path: string;
  target?: string;
  type: string;
}

export interface RegistryItem {
  categories?: string[];
  cssVars?: Record<string, any>;
  dependencies?: string[];
  description?: string;
  devDependencies?: string[];
  files?: RegistryItemFile[];
  meta?: Record<string, unknown>;
  name: string;
  registryDependencies?: string[];
  title: string;
  type: string;
}

// Legacy type aliases for backwards compatibility
export type ComponentCategory = string;
export type Category = string;

// ============================================================================
// Lazy-loaded modules (using JSON for zero compilation overhead)
// ============================================================================

interface StatsData {
  categories: CategoryInfo[];
  totalComponents: number;
}

let _registrySeo: Record<string, CategorySeoInfo> | null = null;

/** The SEO copy of every category, from `seo.json`. */
function getRegistrySeoMapCached(): Record<string, CategorySeoInfo> {
  if (!_registrySeo) {
    _registrySeo = registrySeo as unknown as Record<string, CategorySeoInfo>;
  }
  return _registrySeo;
}

interface MetadataData {
  Metadata: Record<string, Record<string, RegistryItem>>;
}

let _stats: StatsData | null = null;
const _metadataCache: Record<string, MetadataData> = {};
let _catalogItems: ComponentCatalogItem[] | null = null;
let _categoryIndex: Map<string, ComponentCatalogItem[]> | null = null;

function getStats(): StatsData {
  if (!_stats) {
    try {
      const stats = registryStats as unknown as StatsData;
      _stats = {
        categories: stats.categories,
        totalComponents: stats.totalComponents,
      };
    } catch (e) {
      console.error("Failed to load registry stats", e);
      _stats = { categories: [], totalComponents: 0 };
    }
  }
  return _stats;
}

/** The sub-registries of each base, which `getMetadata` merges by item name. */
const SUB_REGISTRIES: Record<string, unknown[][]> = {
  base: [audio, components, lib],
};

/** Merges one sub-registry's items into `metadata` by name. */
function mergeSubRegistry(
  metadata: Record<string, RegistryItem>,
  items: unknown[]
): void {
  for (const item of items as RegistryItem[]) {
    metadata[item.name] = item;
  }
}

function getMetadata(base = "base"): MetadataData {
  if (!_metadataCache[base]) {
    try {
      const metadata: Record<string, RegistryItem> = {};

      // Directly load audio, catalog, and lib registries for reliability and
      // performance. This avoids potential issues with the aggregate registry.ts file
      for (const items of SUB_REGISTRIES[base] ?? []) {
        mergeSubRegistry(metadata, items);
      }

      _metadataCache[base] = { Metadata: { [base]: metadata } };
    } catch (e) {
      console.error(`Failed to load registry for base: ${base}`, e);
      // Fallback to empty if not found
      _metadataCache[base] = { Metadata: { [base]: {} } };
    }
  }
  return _metadataCache[base];
}

/**
 * Get full metadata for all bases or a specific base
 */
export function getRegistryMetadata(base?: string) {
  if (base) {
    const { Metadata } = getMetadata(base);
    return Metadata[base] || {};
  }

  const { Metadata } = getMetadata("base");
  return { base: Metadata.base };
}

/**
 * Get metadata for a specific registry item
 */
export function getRegistryItemMetadata(name: string, base = "base") {
  const { Metadata } = getMetadata(base);
  return Metadata[base]?.[name];
}

const componentCache = new Map<string, React.LazyExoticComponent<any>>();

/** Every registry component a demo or a block can be loaded from, each its own chunk, by its path. */
const componentModules = import.meta.glob<{ default: React.ComponentType }>([
  "../../../registry-audio/bases/*/**/*.tsx",
]);

/**
 * Get a lazy-loaded component by base and name
 */
export function getComponent(
  base: string,
  name: string
): React.LazyExoticComponent<any> | null {
  const cacheKey = `${base}:${name}`;

  const cachedComponent = componentCache.get(cacheKey);
  if (cachedComponent !== undefined) {
    return cachedComponent;
  }

  const item = getRegistryItemMetadata(name, base);
  if (!item?.files?.[0]?.path) {
    return null;
  }

  // The path in the metadata is relative to the base, e.g. "audio/elements/knob.tsx".
  const load =
    componentModules[
      `../../../registry-audio/bases/${base}/${item.files[0].path}`
    ];
  if (!load) {
    return null;
  }

  const lazyComponent = React.lazy(load);

  componentCache.set(cacheKey, lazyComponent);
  return lazyComponent;
}

/**
 * Check if a component exists in the registry
 */
export function hasComponent(base: string, name: string): boolean {
  return !!getRegistryItemMetadata(name, base);
}

// ============================================================================
// Category Functions - Use registry.json category manifest
// ============================================================================

function fallbackCategoryLabel(category: string) {
  return category
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

/**
 * Get all categories with full info (name, label, description, count, seo)
 * This is the primary way to get category data
 */
export function getCategories(): CategoryInfo[] {
  return getStats().categories;
}

/**
 * Get full category info for a single category
 */
export function getCategoryInfo(category: string): CategoryInfo | undefined {
  const normalized = normalizeRegistrySlug(category);
  return getStats().categories.find((c) => c.name === normalized);
}

/**
 * Get category names only
 */
export function getCategoryNames(): string[] {
  return getStats().categories.map((c) => c.name);
}

/**
 * Total number of c-* catalog blocks in `registry.json`.
 */
export function getTotalComponentCount(): number {
  return getStats().totalComponents;
}

/**
 * Catalog block count for a category
 */
export function getComponentCountByCategory(category: string): number {
  return getCategoryInfo(category)?.count ?? 0;
}

/**
 * Get category description
 */
export function getCategoryDescription(category: string): string | undefined {
  return getCategoryInfo(category)?.description;
}

/**
 * Replaces `{{count}}` or legacy `[[count]]` in SEO copy with the live component count from `registry.json`.
 * When count is 0, removes the placeholder and collapses extra spaces.
 * Strings without either placeholder are returned unchanged (avoid accidental word injection).
 */
export function applySeoCountPlaceholder(text: string, count: number): string {
  if (!(text.includes("[[count]]") || text.includes("{{count}}"))) {
    return text;
  }
  if (count > 0) {
    return text
      .replace(/\{\{count\}\}/g, String(count))
      .replace(/\[\[count\]\]/g, String(count));
  }
  return text
    .replace(/\s*\{\{count\}\}\s*/g, " ")
    .replace(/\s*\[\[count\]\]\s*/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
}

/**
 * Build computed SEO metadata for a category page using `seo.json`
 * (lazy-loaded once per runtime) plus category stats from `registry.json`.
 */
export function getComponentCategorySeo(
  category: string
): ComponentCategorySeo {
  const normalized = normalizeRegistrySlug(category);
  const categoryInfo = getCategoryInfo(normalized);
  const label = categoryInfo?.label ?? fallbackCategoryLabel(normalized);
  const count = categoryInfo?.count ?? 0;
  const seo = getRegistrySeoMapCached()[normalized];
  const title = seo?.title ?? `Shadcn ${label}`;

  if (
    seo?.description ||
    seo?.intro ||
    seo?.keywords?.length ||
    seo?.content ||
    seo?.relatedComponents
  ) {
    const genericIntro =
      count > 0
        ? `Browse {{count}} production-ready shadcn ${label.toLowerCase()} components built to help you move from primitives to polished product UI faster.`
        : `Browse production-ready shadcn ${label.toLowerCase()} components built to help you move from primitives to polished product UI faster.`;
    const rawDescription =
      seo?.description ||
      categoryInfo?.description ||
      `Explore free open-source shadcn/ui ${label.toLowerCase()} components for React and Tailwind CSS in audio/ui.`;
    const baseDescription = applySeoCountPlaceholder(rawDescription, count);
    const intro = applySeoCountPlaceholder(seo.intro || genericIntro, count);

    return {
      content: seo?.content,
      description: baseDescription,
      intro,
      keywords: seo?.keywords ?? [],
      relatedComponents: seo?.relatedComponents,
      title,
    };
  }

  const genericDescription =
    categoryInfo?.description ||
    `Explore free open-source shadcn/ui ${label.toLowerCase()} components for React and Tailwind CSS in audio/ui.`;
  const genericIntro =
    count > 0
      ? `Browse {{count}} production-ready shadcn ${label.toLowerCase()} components built to help you move from primitives to polished product UI faster.`
      : `Browse production-ready shadcn ${label.toLowerCase()} components built to help you move from primitives to polished product UI faster.`;

  return {
    content: seo?.content,
    description: applySeoCountPlaceholder(genericDescription, count),
    intro: applySeoCountPlaceholder(genericIntro, count),
    keywords: [],
    relatedComponents: seo?.relatedComponents,
    title,
  };
}

function applyCountToSeoContent(
  content: CategorySeoContent,
  count: number
): CategorySeoContent {
  return {
    ...content,
    faqs: content.faqs?.map((faq) => ({
      ...faq,
      answer: applySeoCountPlaceholder(faq.answer, count),
      question: applySeoCountPlaceholder(faq.question, count),
    })),
    sections: content.sections.map((section) => ({
      ...section,
      bullets: section.bullets?.map((b) => applySeoCountPlaceholder(b, count)),
      componentList: section.componentList?.map((item) => ({
        ...item,
        description: applySeoCountPlaceholder(item.description, count),
        title: applySeoCountPlaceholder(item.title, count),
      })),
      featureItems: section.featureItems?.map((fi) => ({
        ...fi,
        description: applySeoCountPlaceholder(fi.description, count),
        title: applySeoCountPlaceholder(fi.title, count),
      })),
      intro: section.intro
        ? applySeoCountPlaceholder(section.intro, count)
        : undefined,
      paragraphs: section.paragraphs?.map((p) =>
        applySeoCountPlaceholder(p, count)
      ),
      title: applySeoCountPlaceholder(section.title, count),
    })),
    summary: content.summary.map((s) => applySeoCountPlaceholder(s, count)),
    title: applySeoCountPlaceholder(content.title, count),
  };
}

/**
 * SEO for `/components` (index): uses the `root` entry in `seo.json` and total component count.
 */
export function getComponentIndexSeo(): ComponentCategorySeo {
  const count = getTotalComponentCount();
  const { root } = getRegistrySeoMapCached();
  const fallbackDescription = `Browse ${count}+ free open-source shadcn/ui components for React and Tailwind CSS.`;

  if (!(root.content || root.description || root.intro)) {
    return {
      description: fallbackDescription,
      intro: fallbackDescription,
      keywords: [],
      title: "Shadcn UI Components",
    };
  }

  const title = root.title ?? root.content?.title ?? "Shadcn UI Components";
  const description = applySeoCountPlaceholder(
    root.description ?? fallbackDescription,
    count
  );
  const intro = applySeoCountPlaceholder(
    root.intro ?? root.description ?? fallbackDescription,
    count
  );
  const keywords = root.keywords ?? [];
  const content = root.content
    ? applyCountToSeoContent(root.content, count)
    : undefined;
  const relatedComponents = root.relatedComponents
    ? {
        integrationBody: root.relatedComponents.integrationBody,
        items: root.relatedComponents.items,
        links: root.relatedComponents.links,
        title: root.relatedComponents.title,
      }
    : undefined;

  return {
    content,
    description,
    intro,
    keywords,
    relatedComponents,
    title,
  };
}

/**
 * Check if a category is valid
 */
export function isValidCategory(category: string): boolean {
  return !!getCategoryInfo(category);
}

/**
 * Get category sort order
 */
export function getCategorySortOrder(category: string): number {
  const normalized = normalizeRegistrySlug(category);
  const index = getStats().categories.findIndex((c) => c.name === normalized);
  return index === -1 ? Number.POSITIVE_INFINITY : index;
}

export function getCategoryDocsDescription(category: string) {
  const normalized = normalizeRegistrySlug(category);
  const raw = getRegistrySeoMapCached()[normalized]?.docsDescription;
  if (typeof raw !== "string") {
    return;
  }
  const count = getCategoryInfo(normalized)?.count ?? 0;
  return applySeoCountPlaceholder(raw, count);
}

// Legacy exports for backwards compatibility
export const componentCategories = new Proxy([] as string[], {
  get(_target, prop) {
    const names = getStats().categories.map((c) => c.name);
    if (prop === "length") {
      return names.length;
    }
    if (prop === Symbol.iterator) {
      return names[Symbol.iterator].bind(names);
    }
    if (typeof prop === "string" && !Number.isNaN(Number(prop))) {
      return names[Number(prop)];
    }
    if (typeof prop === "string" && prop in Array.prototype) {
      return (names as any)[prop];
    }
  },
  has(_target, prop) {
    return getStats().categories.some((c) => c.name === prop);
  },
}) as unknown as readonly string[];

export const registryCategories = componentCategories;
export const isComponentCategory = isValidCategory;
export function categories<T extends Category[]>(...cats: T): T {
  return cats;
}

// ============================================================================
// Catalog (c-*), lazy index from components.json
// ============================================================================

/** One entry of `components.json`. */
interface ComponentsManifestItem {
  categories?: string[];
  description?: string;
  meta?: ComponentCatalogItem["meta"];
  name: string;
  title?: string;
}

// Load the catalog manifest into a name-keyed map of catalog items.
function loadCatalogItemsByName(): Map<string, ComponentCatalogItem> {
  const itemsByName = new Map<string, ComponentCatalogItem>();

  try {
    // The compact manifest of the catalog, from components.json
    for (const item of componentsManifest as ComponentsManifestItem[]) {
      const itemCategories = item.categories || [];
      let [primaryCategory] = itemCategories;

      if (!primaryCategory) {
        const nameParts = item.name.split("-");
        primaryCategory = nameParts.slice(1, -1).join("-");
      }

      // Smart search text: include name, title, categories
      const searchText = [
        item.name,
        item.title || "",
        ...itemCategories,
        primaryCategory,
      ]
        .join(" ")
        .toLowerCase();

      itemsByName.set(item.name, {
        categories: itemCategories,
        description: item.description || "",
        meta: item.meta,
        name: item.name,
        primaryCategory,
        searchText,
        title: item.title || "",
      });
    }
  } catch (e) {
    console.error("Failed to load components.json manifest", e);
  }

  return itemsByName;
}

// Index catalog items by primary category and by each of their categories.
function buildCategoryIndex(
  sorted: ComponentCatalogItem[]
): Map<string, ComponentCatalogItem[]> {
  const catIndex = new Map<string, ComponentCatalogItem[]>();

  const pushTo = (key: string, item: ComponentCatalogItem) => {
    const bucket = catIndex.get(key);
    if (bucket) {
      bucket.push(item);
    } else {
      catIndex.set(key, [item]);
    }
  };

  for (const item of sorted) {
    const normalizedPrimary = normalizeRegistrySlug(item.primaryCategory);
    pushTo(normalizedPrimary, item);

    for (const cat of item.categories) {
      const normalizedCat = normalizeRegistrySlug(cat);
      if (normalizedCat !== normalizedPrimary) {
        pushTo(normalizedCat, item);
      }
    }
  }

  return catIndex;
}

function ensureCatalogIndexes() {
  if (_catalogItems !== null) {
    return;
  }

  const itemsByName = loadCatalogItemsByName();

  const sorted = Array.from(itemsByName.values()).sort((a, b) => {
    if (a.primaryCategory !== b.primaryCategory) {
      return a.primaryCategory.localeCompare(b.primaryCategory);
    }
    return (a.meta?.order ?? 9999) - (b.meta?.order ?? 9999);
  });

  _catalogItems = sorted;
  _categoryIndex = buildCategoryIndex(sorted);
}

/**
 * All catalog items (c-* blocks), loads full metadata from `components.json`.
 */
export function getAllCatalogItems(): ComponentCatalogItem[] {
  ensureCatalogIndexes();
  return _catalogItems ?? [];
}

/**
 * Catalog items for a category slug
 */
export function getComponentsByCategory(
  category: string
): ComponentCatalogItem[] {
  ensureCatalogIndexes();
  return _categoryIndex?.get(normalizeRegistrySlug(category)) ?? [];
}

/**
 * Search catalog blocks (name, title, categories)
 */
export function searchCatalog(query: string): ComponentCatalogItem[] {
  ensureCatalogIndexes();

  if (!query.trim()) {
    return _catalogItems ?? [];
  }

  const lowerQuery = query.toLowerCase().trim();

  // Exact category match gets priority
  const exactMatch = _categoryIndex?.get(lowerQuery);
  if (exactMatch) {
    return exactMatch;
  }

  // Smart multi-term search
  const terms = lowerQuery.split(WHITESPACE_REGEX).filter(Boolean);
  if (terms.length === 0) {
    return _catalogItems ?? [];
  }

  return (
    _catalogItems?.filter((p) => {
      // All terms must match at least something in the search text
      // We check for partial matches of each term
      return terms.every((term) => {
        // Direct inclusion check
        if (p.searchText.includes(term)) {
          return true;
        }

        // If term is plural (ends with s), try singular
        if (term.length > 3 && term.endsWith("s")) {
          const singular = term.slice(0, -1);
          if (p.searchText.includes(singular)) {
            return true;
          }
        }

        return false;
      });
    }) ?? []
  );
}

// ============================================================================
// Component Functions
// ============================================================================

/**
 * Get a lazy-loaded component by name
 */
export function getRegistryComponent(name: string, styleName = "base-nova") {
  const base = getRegistryKey(styleName);
  return getComponent(base, name);
}

function getRegistryKey(styleName: string): string {
  if (styleName.startsWith("base-")) {
    return "base";
  }
  return styleName;
}
