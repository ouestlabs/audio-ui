"use client";

import * as React from "react";

export function useCopyToClipboard({
  timeout = 2000,
  onCopy,
}: {
  timeout?: number;
  onCopy?: () => void;
} = {}) {
  // When the last copy was made: each one says copied for `timeout` from then on.
  const [copiedAt, setCopiedAt] = React.useState<number | null>(null);

  React.useEffect(() => {
    if (copiedAt === null || timeout === 0) {
      return;
    }
    const timer = setTimeout(() => setCopiedAt(null), timeout);
    return () => clearTimeout(timer);
  }, [copiedAt, timeout]);

  /**
   * Copies a text, or a text still being fetched: Safari only allows the write
   * in the click, so a promise is handed to the clipboard as it is. Resolves to
   * whether the text was copied.
   */
  const copyToClipboard = React.useCallback(
    (value: string | Promise<string>): Promise<boolean> => {
      if (typeof window === "undefined" || !navigator.clipboard.writeText) {
        return Promise.resolve(false);
      }

      if (!value) {
        return Promise.resolve(false);
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

      return written.then(
        () => {
          setCopiedAt(performance.now());

          if (onCopy) {
            onCopy();
          }
          return true;
        },
        (error: unknown) => {
          console.error(error);
          return false;
        }
      );
    },
    [onCopy]
  );

  return { copyToClipboard, isCopied: copiedAt !== null };
}
