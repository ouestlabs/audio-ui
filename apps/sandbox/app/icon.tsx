import { ImageResponse } from "next/og";

export const size = {
  height: 32,
  width: 32,
};
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    <div
      style={{
        alignItems: "center",
        background: "black",
        borderRadius: "5px",
        display: "flex",
        height: "100%",
        justifyContent: "center",
        width: "100%",
      }}
    >
      <svg
        aria-hidden="true"
        fill="none"
        height="24"
        stroke="white"
        stroke-linecap="round"
        stroke-linejoin="round"
        stroke-width="2"
        viewBox="0 0 24 24"
        width="24"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path d="M2 10v3" fill="white" />
        <path d="M6 6v11" fill="white" />
        <path d="M10 3v18" fill="white" />
        <path d="M14 8v7" fill="white" />
        <path d="M18 5v13" fill="white" />
        <path d="M22 10v3" fill="white" />
      </svg>
    </div>,
    { ...size }
  );
}
