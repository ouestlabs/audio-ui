import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useCopyToClipboard } from "@/hooks/use-copy-to-clipboard";
import { useFramework } from "@/hooks/use-framework";
import {
  FRAMEWORKS,
  type FrameworkId,
  isFramework,
} from "@/lib/docs/content/frameworks";
import {
  BUILD_PROMPT,
  QUICK_START_PROMPTS,
} from "@/lib/docs/content/quick-start";

/** A prompt to copy into an agent: its text as written, and a button that copies it. */
function PromptBox({
  children,
  label,
  text,
}: {
  children?: React.ReactNode;
  label?: string;
  text: string;
}) {
  const { copyToClipboard, isCopied } = useCopyToClipboard();
  return (
    <div className="not-prose my-4 overflow-hidden rounded-lg border bg-card text-card-foreground">
      <div className="flex items-center justify-between gap-2 border-b p-2">
        {children ?? (
          <span className="px-2 text-muted-foreground text-sm">{label}</span>
        )}
        <Button
          onClick={() => copyToClipboard(text)}
          size="sm"
          variant="secondary"
        >
          {isCopied ? "Copied" : "Copy Prompt"}
        </Button>
      </div>
      <pre className="whitespace-pre-wrap p-4 font-mono text-sm leading-relaxed">
        {text}
      </pre>
    </div>
  );
}

/**
 * How to set audio/ui up, as a prompt for an agent rather than a command: the
 * framework picked here is the one the whole site keeps, and a second prompt
 * asks for a first component.
 */
export function QuickStart() {
  const [kept, choose] = useFramework();
  const framework: FrameworkId = kept ?? "react";
  return (
    <>
      <p>Pick your framework, then copy this prompt into your agent.</p>
      <PromptBox text={QUICK_START_PROMPTS[framework]}>
        <Select
          onValueChange={(next) => {
            if (isFramework(next)) {
              choose(next);
            }
          }}
          value={framework}
        >
          <SelectTrigger aria-label="Framework">
            <SelectValue>
              {FRAMEWORKS.find((item) => item.id === framework)?.label}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              {FRAMEWORKS.map((item) => (
                <SelectItem key={item.id} value={item.id}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
      </PromptBox>
      <p>Then ask your agent to build a component:</p>
      <PromptBox label="Prompt" text={BUILD_PROMPT} />
    </>
  );
}
