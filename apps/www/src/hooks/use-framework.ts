import { createKeptChoice } from "@/hooks/use-kept-choice";
import { type FrameworkId, isFramework } from "@/lib/docs/content/frameworks";

const framework = createKeptChoice<FrameworkId>({
  isValid: isFramework,
  key: "audio-ui-framework",
  param: "framework",
});

/** Keeps a framework in the browser and tells every reader of it, the address left as it is: a choice that goes to another page carries it in that page's link. */
export const rememberFramework = framework.remember;

/**
 * The framework the reader uses, as they chose it in the sidebar or a
 * framework's tab, and the way to choose: kept in their browser, and in the
 * address as `?framework=` so a link carries it, a link's winning over the
 * one kept. Null until they choose, and on the server: the pages are
 * prerendered for any framework.
 */
export const useFramework = framework.useChoice;
