/**
 * Types every element for Vue templates: the properties it takes and the
 * events it fires, as Vue's guide to custom elements recommends. Import them
 * once in a project, apart from the elements themselves:
 *
 * ```ts
 * import type {} from "@audio-ui/elements/vue";
 * ```
 */
import type { EmitFn, HTMLAttributes, PublicProps } from "vue";
import type { ElementTemplates } from "./templates.generated.ts";

type Tag = keyof ElementTemplates & keyof HTMLElementTagNameMap;

/** The properties a template can give an element: the ones it has a setter for. */
type Properties<T extends Tag> = {
  [Name in ElementTemplates[T]["properties"] &
    keyof HTMLElementTagNameMap[T]]?: HTMLElementTagNameMap[T][Name];
};

/** An attribute's name as Vue checks it on a component: `drag-mode` as `dragMode`. */
type CamelCase<Name extends string> = Name extends `${infer Head}-${infer Tail}`
  ? `${Head}${Capitalize<CamelCase<Tail>>}`
  : Name;

/** The attributes an element observes that are not properties too, as text. */
type Attributes<T extends Tag> = {
  [Name in Exclude<
    ElementTemplates[T]["attributes"],
    ElementTemplates[T]["properties"]
  > as CamelCase<Name>]?: string | number | boolean | null;
};

/** The events an element fires of its own: the custom events of its map. */
type OwnEvents<Map> = {
  [Name in keyof Map as Map[Name] extends CustomEvent
    ? Name
    : never]: Map[Name];
};

/** An element as Vue reads a component in a template: its properties from `$props`, its events from `$emit`. */
type DefineCustomElement<T extends Tag> = new () => HTMLElementTagNameMap[T] & {
  /** @deprecated Types the element in templates only: an element has no `$props`. */
  $props: Omit<
    HTMLAttributes,
    `on${Capitalize<keyof OwnEvents<ElementTemplates[T]["events"]> & string>}`
  > &
    Attributes<T> &
    Properties<T> &
    PublicProps;
  /** @deprecated Types the element in templates only: an element has no `$emit`. */
  $emit: EmitFn<{
    [Name in keyof OwnEvents<ElementTemplates[T]["events"]>]: (
      event: OwnEvents<ElementTemplates[T]["events"]>[Name]
    ) => void;
  }>;
};

type AudioUiComponents = { [T in Tag]: DefineCustomElement<T> };

declare module "vue" {
  interface GlobalComponents extends AudioUiComponents {}
}
