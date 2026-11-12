import { Icons } from "@/components/site/icons";
import { cn } from "@/lib/utils";

/**
 * The name, set as audio.js sets its own: the mark, the word in Geist, heavy
 * and tight, then `/ui` close after it, in the regular weight. Its size is
 * the text size it is given.
 */
export function Wordmark({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "flex shrink-0 select-none items-center gap-2 font-(family-name:--font-geist-sans) font-[650] leading-none tracking-[-0.05em]",
        className
      )}
    >
      <Icons.audioUi className="pointer-events-none size-[0.9em]" />
      <span>
        audio
        <span className="font-normal tracking-[-0.02em]">/ui</span>
      </span>
    </span>
  );
}
