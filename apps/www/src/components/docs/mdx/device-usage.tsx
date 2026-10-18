import { highlightedElements } from "@/components/code/block/highlighted-code";
import { CopyButton } from "@/components/code/copy/copy-button";
import { devicePanelUsage } from "@/lib/docs/content/device-usage";

/** A device page's snippet for its panel, drawn as a fence of the page is. */
export function DeviceUsage({ name }: { name: string }) {
  const code = devicePanelUsage(name);
  const { elements } = highlightedElements(code, "tsx", false);
  return (
    <figure className="" data-not-typeset="" data-rehype-pretty-code-figure="">
      <pre
        className="scrollbar-y min-w-0 overflow-x-auto px-4 py-3.5 outline-none has-data-[slot=tabs]:p-0 th-code th-code--tsx"
        data-language="tsx"
      >
        <CopyButton value={code} />
        <code>{elements}</code>
      </pre>
    </figure>
  );
}
