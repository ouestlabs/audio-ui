import { ImageResponse } from "next/og";

export const size = { height: 180, width: 180 };
export const contentType = "image/png";

// iOS rounds the corners itself, so the square stays square.
export default function AppleIcon() {
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
        height="112"
        viewBox="2 2 20 20"
        width="112"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path d="M13.799 11.884L18.243 4.188A10 10 0 1 1 15.645 2.688L11.201 10.384Z" />
      </svg>
    </div>,
    { ...size }
  );
}
