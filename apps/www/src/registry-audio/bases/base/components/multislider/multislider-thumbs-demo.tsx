import { Multislider } from "@/registry-audio/bases/base/audio/elements/multislider";

const defaultLevels = [0.25, 0.55, 0.75, 0.4, 0.65, 0.9];

export default function MultisliderThumbsDemo() {
  return (
    <Multislider
      aria-label="Band gains"
      className="max-w-md"
      defaultValue={defaultLevels}
      thumbs="visible"
    />
  );
}
