import { ImageResponse } from "next/og";

export const revalidate = false;

// Maskable icon for the web app manifest: full-bleed background, and the knob
// inside the 80% safe zone so any launcher mask keeps it whole.
export function GET() {
  return new ImageResponse(
    <div
      style={{
        alignItems: "center",
        background: "black",
        display: "flex",
        height: "100%",
        justifyContent: "center",
        width: "100%",
      }}
    >
      <svg
        aria-hidden="true"
        fill="white"
        height="280"
        viewBox="2 2 20 20"
        width="280"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path d="M13.799 11.884L18.243 4.188A10 10 0 1 1 15.645 2.688L11.201 10.384Z" />
      </svg>
    </div>,
    { height: 512, width: 512 }
  );
}
