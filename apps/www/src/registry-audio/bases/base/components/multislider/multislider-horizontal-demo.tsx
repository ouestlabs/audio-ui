import { Multislider } from "@/registry-audio/bases/base/audio/elements/multislider";

const initialBands = [0.4, 0.7, 0.55, 0.8];

export default function MultisliderHorizontalDemo() {
  return (
    <Multislider
      aria-label="Send levels"
      className="max-w-md"
      defaultValue={initialBands}
      orientation="horizontal"
      size="sm"
    />
  );
}
