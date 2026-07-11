import { Multislider } from "@/registry-audio/bases/base/audio/elements/multislider";

const defaultLevels = [0.2, 0.45, 0.7, 0.9, 0.6, 0.35];

export default function MultisliderDisabledDemo() {
  return (
    <Multislider
      aria-label="Levels"
      className="max-w-md"
      defaultValue={defaultLevels}
      disabled
    />
  );
}
