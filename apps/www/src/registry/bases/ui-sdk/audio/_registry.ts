import type { RegistryItem } from "shadcn/schema";
import { audio as baseAudio } from "../../base/audio/_registry";

const SDK = ["@ui-sdk/core", "@ui-sdk/react"];

/** The items whose files name a behavior library: the base's, over ui-sdk. */
export const audio: RegistryItem[] = ["rocker-switch", "parameter-field"].map(
  (name) => {
    const item = baseAudio.find((each) => each.name === name);
    if (!item) {
      throw new Error(`${name} is not an item of the base`);
    }
    return {
      ...item,
      dependencies: [
        ...SDK,
        ...(item.dependencies ?? []).filter(
          (dependency) => dependency !== "@base-ui/react"
        ),
      ],
    };
  }
);
