import { useCallback, useRef } from "react";

/** The key that loads a file of the person's own, with the file input behind it. */
export function Load({ onFile }: { onFile: (file: File) => void }) {
  const input = useRef<HTMLInputElement>(null);
  const open = useCallback(() => input.current?.click(), []);
  const change = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const chosen = event.currentTarget.files?.[0];
      if (chosen) {
        onFile(chosen);
      }
      // The same file chosen again still fires.
      event.currentTarget.value = "";
    },
    [onFile]
  );
  return (
    <>
      <button className="altair-switch" onClick={open} type="button">
        Load
      </button>
      <input
        accept="audio/*"
        aria-label="Load an audio file"
        className="altair-file"
        onChange={change}
        ref={input}
        tabIndex={-1}
        type="file"
      />
    </>
  );
}
