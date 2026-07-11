import { Multislider } from "@/registry-audio/bases/base/audio/elements/multislider";

const stepVelocities = [3, 5, 7, 2, 6, 4, 8, 1];

export default function MultisliderSteppedDemo() {
  return (
    <Multislider
      aria-label="Step velocities"
      className="max-w-md"
      defaultValue={stepVelocities}
      max={8}
      min={0}
      step={1}
    />
  );
}
