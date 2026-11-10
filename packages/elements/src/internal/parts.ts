import { connectPart, ElementBase, reflect } from "./element.ts";

/** What a part does on each change: draw itself from its control's snapshot. */
export interface Painted<Snapshot> {
  paint: (snapshot: Snapshot) => void;
}

/**
 * The root element of a control: it takes its attributes as the
 * controller's options, holds the subscription to the controller, and
 * paints itself and every part from one snapshot on each change.
 */
export abstract class ControlRoot<Snapshot> extends ElementBase {
  readonly #parts = new Set<Painted<Snapshot>>();
  #stop: (() => void) | undefined;

  connectedCallback() {
    this.configure();
    this.#stop ??= this.subscribe(() => this.paint());
    this.paint();
  }

  disconnectedCallback() {
    this.#stop?.();
    this.#stop = undefined;
  }

  /** Paints the control and every part from the controller's snapshot. */
  paint() {
    const snapshot = this.snapshot();
    reflect(this, this.rootAttributes(snapshot));
    for (const part of this.#parts) {
      part.paint(snapshot);
    }
  }

  /** Called by a part when it connects: it is painted at once, then on every change. */
  attach(part: Painted<Snapshot>) {
    this.#parts.add(part);
    part.paint(this.snapshot());
  }

  detach(part: Painted<Snapshot>) {
    this.#parts.delete(part);
  }

  /** Gives the controller the options the attributes and properties say. */
  protected abstract configure(): void;

  /** The controller's snapshot, as it is now. */
  protected abstract snapshot(): Snapshot;

  /** Listens to the controller; returns what stops listening. */
  protected abstract subscribe(listener: () => void): () => void;

  /** The attributes the root carries from the snapshot: its state, and its role where it has one. */
  protected abstract rootAttributes(
    snapshot: Snapshot
  ): Record<string, string | null>;
}

/**
 * A part of a control: it finds its root, the closest element around it of
 * the root's tag, and carries the control's state as data attributes.
 */
export abstract class ControlPart<Root extends ControlRoot<Snapshot>, Snapshot>
  extends ElementBase
  implements Painted<Snapshot>
{
  protected root: Root | null = null;

  connectedCallback() {
    connectPart(
      this,
      this.rootTag,
      (element): element is Root => this.isRoot(element),
      (root) => {
        this.root = root;
        this.attached(root);
        root.attach(this);
      }
    );
  }

  disconnectedCallback() {
    const { root } = this;
    if (root) {
      root.detach(this);
      this.detached(root);
      this.root = null;
    }
  }

  paint(snapshot: Snapshot) {
    reflect(this, this.state(snapshot));
  }

  /** The tag of the control's root. */
  protected abstract readonly rootTag: string;

  /** Whether `element` is the control's root, upgraded. */
  protected abstract isRoot(element: Element | null): boolean;

  /** The control's state, as the data attributes every part carries. */
  protected abstract state(snapshot: Snapshot): Record<string, string | null>;

  protected attached(_root: Root): void {
    // A part with nothing of its own to set up.
  }

  protected detached(_root: Root): void {
    // A part with nothing of its own to let go of.
  }
}

/**
 * Fires `input` on `element` for a change, or the event named `type` for a
 * change of something besides its value, as a cancelable event that bubbles
 * out of a shadow root too. Returns whether the change stands:
 * `preventDefault()` refuses it.
 */
export function reportChange<Detail>(
  element: Element,
  detail: Detail,
  type = "input"
) {
  return element.dispatchEvent(
    new CustomEvent(type, {
      bubbles: true,
      cancelable: true,
      composed: true,
      detail,
    })
  );
}

/** Fires `change` on `element` once a gesture that changed the value ends, or the event named `type`. */
export function reportCommit<Detail>(
  element: Element,
  detail: Detail,
  type = "change"
) {
  element.dispatchEvent(
    new CustomEvent(type, { bubbles: true, composed: true, detail })
  );
}
