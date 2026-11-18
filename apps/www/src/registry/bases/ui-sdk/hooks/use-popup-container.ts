import { useSyncExternalStore } from "react";

const subscribe = () => () => undefined;
const inBody = () => document.body;
const onServer = () => null;

/**
 * Where the popups of the ui components render: the page's body, as a portal
 * would, so that a button group or a panel that clips never holds them. It is
 * `null` while the server renders and while the browser hydrates, then the body.
 */
export function usePopupContainer() {
  return useSyncExternalStore(subscribe, inBody, onServer);
}
