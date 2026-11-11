/**
 * Types every element for Svelte templates: its attributes, the properties
 * it takes and an `on…` handler for each event it fires, added to
 * `svelte/elements` as Svelte's guide to TypeScript recommends. Import them
 * once in a project, apart from the elements themselves:
 *
 * ```ts
 * import type {} from "@audio-ui/elements/svelte";
 * ```
 */
import type { EventHandler, HTMLAttributes } from "svelte/elements";
import type { ElementTemplates } from "./templates.generated.ts";

type Tag = keyof ElementTemplates & keyof HTMLElementTagNameMap;

/** The properties a template can give an element: the ones it has a setter for. */
type Properties<T extends Tag> = {
  [Name in ElementTemplates[T]["properties"] &
    keyof HTMLElementTagNameMap[T]]?: HTMLElementTagNameMap[T][Name];
};

/** The events an element fires of its own: the custom events of its map. */
type OwnEvents<T extends Tag> = {
  [Name in keyof ElementTemplates[T]["events"] as ElementTemplates[T]["events"][Name] extends CustomEvent
    ? Name & string
    : never]: ElementTemplates[T]["events"][Name];
};

/** What an element takes in a template: every element's attributes, its own as text, its properties, and its events' handlers. */
type ElementAttributes<T extends Tag> = Omit<
  HTMLAttributes<HTMLElementTagNameMap[T]>,
  `on${keyof OwnEvents<T> & string}`
> &
  Partial<
    Record<
      Exclude<
        ElementTemplates[T]["attributes"],
        ElementTemplates[T]["properties"]
      >,
      string | number | boolean | null
    >
  > &
  Properties<T> & {
    [Name in keyof OwnEvents<T> as `on${Name & string}`]?: EventHandler<
      OwnEvents<T>[Name] & Event,
      HTMLElementTagNameMap[T]
    > | null;
  };

type AudioUiElements = { [T in Tag]: ElementAttributes<T> };

declare module "svelte/elements" {
  interface SvelteHTMLElements extends AudioUiElements {}
}
