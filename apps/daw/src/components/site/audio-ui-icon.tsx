import type { ComponentProps } from "react";

/** The audio/ui mark, as the docs and the lab draw it. */
export function AudioUiIcon(props: ComponentProps<"svg">) {
  return (
    <svg
      aria-hidden="true"
      fill="currentColor"
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <path d="M13.799 11.884L18.243 4.188A10 10 0 1 1 15.645 2.688L11.201 10.384Z" />
    </svg>
  );
}
