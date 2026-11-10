/**
 * The items of an element that makes them, such as a piano's keys or a
 * meter's channels: one element of `tag` per key, its key in `attribute`,
 * each holding what the host's `<template>` holds. They are made again when
 * the keys change, the ones that stay kept as they are, and filled again
 * when the template arrives or changes: a page being read connects the host
 * before its template.
 */
export class Stamp {
  readonly #host: Element;
  readonly #tag: string;
  readonly #attribute: string;
  readonly #prepare: ((item: Element, key: number) => void) | undefined;
  #template: HTMLTemplateElement | undefined;
  #watch: MutationObserver | undefined;

  constructor(
    host: Element,
    tag: string,
    attribute: string,
    prepare?: (item: Element, key: number) => void
  ) {
    this.#host = host;
    this.#tag = tag;
    this.#attribute = attribute;
    this.#prepare = prepare;
  }

  /** Starts watching the host for its template. */
  connect() {
    this.#watch = new MutationObserver(() => this.#takeTemplate());
    this.#watch.observe(this.#host, { childList: true });
    this.#takeTemplate();
  }

  disconnect() {
    this.#watch?.disconnect();
  }

  /** The items made so far, in order. */
  items(): Element[] {
    return [...this.#host.children].filter(
      (child) => child.localName === this.#tag
    );
  }

  /** Makes an item per key, in that order, keeping the ones whose key stays. */
  update(keys: readonly number[]) {
    const made = new Map<number, Element>();
    for (const item of this.items()) {
      made.set(Number(item.getAttribute(this.#attribute)), item);
    }
    const items = keys.map((key) => {
      const existing = made.get(key);
      made.delete(key);
      if (existing) {
        return existing;
      }
      const item = document.createElement(this.#tag);
      item.setAttribute(this.#attribute, String(key));
      this.#prepare?.(item, key);
      this.#fill(item);
      return item;
    });
    for (const gone of made.values()) {
      gone.remove();
    }
    for (const item of items) {
      this.#host.appendChild(item);
    }
  }

  #takeTemplate() {
    const template = [...this.#host.children].find(
      (child): child is HTMLTemplateElement =>
        child instanceof HTMLTemplateElement
    );
    if (template === this.#template) {
      return;
    }
    this.#template = template;
    for (const item of this.items()) {
      this.#fill(item);
    }
  }

  /** Puts in `item` what the template holds, in place of what it held. */
  #fill(item: Element) {
    // Imported, not cloned: a clone stays in the template's document, where no element upgrades.
    item.replaceChildren(
      ...(this.#template
        ? [document.importNode(this.#template.content, true)]
        : [])
    );
  }
}
