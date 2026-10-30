/**
 * A browser that translates the page (Edge and Chrome offer to) puts its own
 * text in place of the text nodes React rendered. React still holds the old
 * nodes, so its next insert before one of them, or removal of one, throws
 * NotFoundError and the error page replaces the docs. Those two calls are
 * skipped when the node has moved: the page stays up, though what React adds
 * there after the translation can be missing until a reload.
 */
export function guardTranslatedPage() {
  const { insertBefore, removeChild } = Node.prototype;
  Node.prototype.insertBefore = function <T extends Node>(
    this: Node,
    node: T,
    child: Node | null
  ) {
    if (child && child.parentNode !== this) {
      return node;
    }
    return insertBefore.call(this, node, child) as T;
  };
  Node.prototype.removeChild = function <T extends Node>(this: Node, child: T) {
    if (child.parentNode !== this) {
      return child;
    }
    return removeChild.call(this, child) as T;
  };
  return () => {
    Node.prototype.insertBefore = insertBefore;
    Node.prototype.removeChild = removeChild;
  };
}
