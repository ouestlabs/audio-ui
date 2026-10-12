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
        fill="white"
        height="20"
        viewBox="2 2 20 20"
        width="20"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path d="M13.799 11.884L18.243 4.188A10 10 0 1 1 15.645 2.688L11.201 10.384Z" />
      </svg>
    </div>,
    { ...size }
  );
}
