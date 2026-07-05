import { ImageResponse } from "next/og";

export const size = {
  width: 32,
  height: 32,
};
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    <div
      style={{
        background: "black",
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        borderRadius: "5px",
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
