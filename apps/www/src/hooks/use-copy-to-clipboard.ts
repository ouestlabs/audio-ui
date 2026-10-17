"use client";

import * as React from "react";

export function useCopyToClipboard({
  timeout = 2000,
  onCopy,
}: {
  timeout?: number;
  onCopy?: () => void;
} = {}) {
  const [isCopied, setIsCopied] = React.useState(false);

  /** Copies a text, or a text still being fetched: Safari only allows the write in the click, so a promise is handed to the clipboard as it is. */
  const copyToClipboard = (value: string | Promise<string>) => {
    if (typeof window === "undefined" || !navigator.clipboard.writeText) {
      return;
    }

    if (!value) {
      return;
    }

    const written =
      typeof value === "string" || typeof ClipboardItem === "undefined"
        ? Promise.resolve(value).then((text) =>
            navigator.clipboard.writeText(text)
          )
        : navigator.clipboard.write([
            new ClipboardItem({
              "text/plain": value.then(
                (text) => new Blob([text], { type: "text/plain" })
              ),
            }),
          ]);

    written.then(() => {
      setIsCopied(true);

      if (onCopy) {
        onCopy();
      }

      if (timeout !== 0) {
        setTimeout(() => {
          setIsCopied(false);
        }, timeout);
      }
    }, console.error);
  };

  return { copyToClipboard, isCopied };
}
