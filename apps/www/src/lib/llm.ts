import fs from "node:fs";
import path from "node:path";

import { expandDeviceControls } from "@/lib/device-docs";
import { getRegistryItemMetadata } from "@/lib/registry";

const NAME_ATTR_REGEX = /name="([^"]+)"/;

export function processMdxForLLMs(content: string) {
  if (!content || typeof content !== "string") {
    return content || "";
  }

  const tagRegex = /<(ComponentPreview|ComponentSource)\s+([^>]+)\/>/g;

  return expandDeviceControls(content).replace(
    tagRegex,
    (match, tag, attributes) => {
      try {
        const name = attributes.match(NAME_ATTR_REGEX)?.[1];

        if (!name) {
          return match;
        }

        const item = getRegistryItemMetadata(name, "base");

        if (!item?.files?.length) {
          return match;
        }

        const filePath = item.files[0].path;
        const absolutePath = path.join(process.cwd(), filePath);

        if (!fs.existsSync(absolutePath)) {
          return match;
        }

        let source = fs.readFileSync(absolutePath, "utf8");
        source = source.replaceAll(
          "@/registry-audio/bases/base/",
          "@/components/"
        );
        source = source.replaceAll("export default", "export");

        return `\`\`\`tsx
${source}
\`\`\``;
      } catch (error) {
        console.error(`Error processing ${tag} for ${match}:`, error);
        return match;
      }
    }
  );
}
