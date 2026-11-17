const WHITESPACE_REGEX = /\s+/;

// Pick the quote character matching whichever string-literal group matched.
function pickQuote(dq: string | undefined, sq: string | undefined): string {
  if (dq !== undefined) {
    return '"';
  }
  if (sq !== undefined) {
    return "'";
  }
  return "`";
}

/** A string Step 1 emptied of its classes, until its line is dropped: never in a source. */
const EMPTIED = "\u0000emptied\u0000";
const EMPTIED_LINE = /^\s*(["'`])\u0000emptied\u0000\1\s*,?\s*\n/gm;
const EMPTIED_STRING = /\u0000emptied\u0000/g;

/**
 * Transforms style-specific class names based on the current style.
 * Finds ALL string literals (in any context, className, cn(), cva(), etc.)
 * containing "style-*:" prefixed tokens, keeps only the classes matching
 * the current style (with the prefix stripped), and removes the rest.
 * Empty strings left after stripping are cleaned up.
 *
 * Examples:
 *   className="base style-vega:bg-white style-nova:bg-black"
 *     → (nova) className="base bg-black"
 *
 *   cn("style-vega:px-2 style-vega:py-1", "style-nova:px-3 style-nova:py-2")
 *     → (nova) cn("px-3 py-2")   // the vega-only string + its line removed
 *
 *   cva(["style-vega:shadow-xs"])
 *     → (nova) cva([])            // empty string entry removed
 */
export function transformStyleClassNames(
  code: string,
  styleName: string
): string {
  // Extract the visual style name (e.g., "nova" from "base-nova")
  const style = styleName.split("-").pop() || styleName;
  const stylePrefix = `style-${style}:`;

  // Step 1: Transform style-* tokens inside ALL string literals.
  // Matches double-quoted, single-quoted, and backtick strings containing "style-".
  // IMPORTANT: \n is included in the negated character classes to prevent the regex
  // from matching across line boundaries (which would collapse multi-line code blocks
  // into a single line when .split(/\s+/).join(" ") runs on the captured content).
  let result = code.replace(
    /"([^"\n]*style-[^"\n]*)"|'([^'\n]*style-[^'\n]*)'|`([^`\n]*style-[^`\n]*)`/g,
    (_match, dq, sq, bt) => {
      const content = dq ?? sq ?? bt;
      const quote = pickQuote(dq, sq);

      const resolved = content
        .split(WHITESPACE_REGEX)
        .flatMap((cls: string) => {
          if (cls.startsWith("style-")) {
            const stripped = cls.startsWith(stylePrefix)
              ? cls.slice(stylePrefix.length)
              : null;
            return stripped ? [stripped] : [];
          }
          return cls ? [cls] : [];
        })
        .join(" ")
        .trim();

      return `${quote}${resolved || EMPTIED}${quote}`;
    }
  );

  // Step 2: Remove the lines that are now just a string Step 1 emptied, with
  // an optional trailing comma; an empty string written as such stays.
  result = result.replace(EMPTIED_LINE, "").replace(EMPTIED_STRING, "");

  // Step 3: Collapse 3+ consecutive newlines into one blank line.
  result = result.replace(/\n{3,}/g, "\n\n");

  return result;
}
