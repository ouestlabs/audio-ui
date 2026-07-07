import { ImageResponse } from "next/og";
import type { ReactElement } from "react";
import { siteConfig } from "@/lib/config";

export const OG_SIZE = { height: 630, width: 1200 };

export const tokens = Object.freeze({
  accent: "#686868",
  background: "#0a0a0a",

  border: "#333333",
  borderBack: "#1e1e1e",
  borderMid: "#282828",
  controlBody: "#202020",
  controlBorder: "#3a3a3a",
  controlFill: "#404040",
  controlThumb: "#303030",
  controlThumbBorder: "#505050",

  controlTrack: "#242424",
  foreground: "#e8e8e8",
  surface: "#1a1a1a",
  surfaceBack: "#111111",
  surfaceMid: "#151515",
});

export function Knob({ angle }: { angle: number }) {
  const rad = (angle * Math.PI) / 180;
  const cx = 30;
  const cy = 30;
  const dotR = 18;
  const dotX = +(cx + dotR * Math.sin(rad)).toFixed(2);
  const dotY = +(cy - dotR * Math.cos(rad)).toFixed(2);

  const arcR = 23;
  const a0 = (-135 * Math.PI) / 180;
  const a1 = (135 * Math.PI) / 180;
  const sx = +(cx + arcR * Math.sin(a0)).toFixed(2);
  const sy = +(cy - arcR * Math.cos(a0)).toFixed(2);
  const ex = +(cx + arcR * Math.sin(a1)).toFixed(2);
  const ey = +(cy - arcR * Math.cos(a1)).toFixed(2);
  const arcD = `M ${sx} ${sy} A ${arcR} ${arcR} 0 1 1 ${ex} ${ey}`;

  const aRad = Math.max(-135, Math.min(135, angle));
  const aRadRad = (aRad * Math.PI) / 180;
  const ax = +(cx + arcR * Math.sin(aRadRad)).toFixed(2);
  const ay = +(cy - arcR * Math.cos(aRadRad)).toFixed(2);
  const sweep = aRad + 135;
  const largeArc = sweep > 180 ? 1 : 0;
  const activeD = `M ${sx} ${sy} A ${arcR} ${arcR} 0 ${largeArc} 1 ${ax} ${ay}`;

  return (
    <svg aria-hidden="true" height="60" viewBox="0 0 60 60" width="60">
      <circle
        cx={30}
        cy={30}
        fill={tokens.controlBody}
        r={27}
        stroke={tokens.controlBorder}
        strokeWidth="1"
      />
      <path
        d={arcD}
        fill="none"
        stroke={tokens.controlBorder}
        strokeLinecap="round"
        strokeWidth="2.5"
      />
      <path
        d={activeD}
        fill="none"
        stroke={tokens.accent}
        strokeLinecap="round"
        strokeWidth="2.5"
      />
      <circle cx={dotX} cy={dotY} fill={tokens.accent} r={4} />
    </svg>
  );
}

export function Fader({ pos }: { pos: number }) {
  const trackH = 108;
  const thumbH = 12;
  const thumbTop = Math.round(pos * (trackH - thumbH));

  return (
    <div
      style={{
        alignItems: "center",
        display: "flex",
        height: `${trackH}px`,
        justifyContent: "center",
        position: "relative",
        width: "40px",
      }}
    >
      <div
        style={{
          backgroundColor: tokens.controlTrack,
          border: `1px solid ${tokens.controlBorder}`,
          borderRadius: "3px",
          height: `${trackH}px`,
          left: "17px",
          position: "absolute",
          width: "6px",
        }}
      />
      <div
        style={{
          backgroundColor: tokens.controlThumb,
          border: `1px solid ${tokens.controlThumbBorder}`,
          borderRadius: "4px",
          height: "14px",
          left: "1px",
          position: "absolute",
          top: `${thumbTop}px`,
          width: "38px",
        }}
      />
    </div>
  );
}

export function Transport({ progress }: { progress: number }) {
  const w = 760;
  const thumbX = Math.round(progress * w);

  return (
    <div
      style={{
        backgroundColor: tokens.controlTrack,
        borderRadius: "999px",
        display: "flex",
        height: "5px",
        position: "relative",
        width: `${w}px`,
      }}
    >
      <div
        style={{
          backgroundColor: tokens.controlFill,
          borderRadius: "999px",
          height: "100%",
          width: `${thumbX}px`,
        }}
      />
      <div
        style={{
          backgroundColor: tokens.accent,
          border: `1px solid ${tokens.controlThumbBorder}`,
          borderRadius: "50%",
          height: "8px",
          left: `${thumbX - 4}px`,
          position: "absolute",
          top: "-2px",
          width: "8px",
        }}
      />
    </div>
  );
}

export function XYPad({ x, y }: { x: number; y: number }) {
  const s = 182;
  const dotX = +(x * s).toFixed(1);
  const dotY = +((1 - y) * s).toFixed(1);

  return (
    <svg
      aria-hidden="true"
      height={s}
      style={{ borderRadius: "6px" }}
      viewBox={`0 0 ${s} ${s}`}
      width={s}
    >
      <rect
        fill={tokens.controlTrack}
        height={s}
        rx="6"
        width={s}
        x="0"
        y="0"
      />
      <rect
        fill="none"
        height={s}
        rx="6"
        stroke={tokens.controlBorder}
        strokeWidth="1"
        width={s}
        x="0"
        y="0"
      />
      <line
        stroke={tokens.controlBorder}
        strokeWidth="1"
        x1="0"
        x2={s}
        y1={dotY}
        y2={dotY}
      />
      <line
        stroke={tokens.controlBorder}
        strokeWidth="1"
        x1={dotX}
        x2={dotX}
        y1="0"
        y2={s}
      />
      <circle
        cx={dotX}
        cy={dotY}
        fill={tokens.accent}
        r="6"
        stroke={tokens.controlThumbBorder}
        strokeWidth="1"
      />
    </svg>
  );
}

const STRIPS: [angle: number, pos: number][] = [
  [-60, 0.25],
  [30, 0.55],
  [90, 0.35],
  [-20, 0.7],
  [60, 0.45],
];

const CARD_TOP = 358;

export function generateHomeOG(): ReactElement {
  const cardBase = {
    borderTopLeftRadius: "18px",
    borderTopRightRadius: "18px",
    bottom: 0,
    position: "absolute" as const,
  };

  return (
    <div
      style={{
        backgroundColor: tokens.background,
        display: "flex",
        flexDirection: "column",
        fontFamily: "Instrument Serif, Georgia, serif",
        height: "100%",
        overflow: "hidden",
        position: "relative",
        width: "100%",
      }}
    >
      <div
        style={{
          alignItems: "center",
          display: "flex",
          flexDirection: "column",
          gap: "14px",
          paddingTop: "68px",
        }}
      >
        <span
          style={{
            color: tokens.foreground,
            fontSize: "88px",
            fontWeight: 700,
            letterSpacing: "-0.01em",
            lineHeight: 1,
          }}
        >
          {siteConfig.name}
        </span>
        <span
          style={{
            color: tokens.accent,
            fontSize: "26px",
            letterSpacing: "0.01em",
            lineHeight: 1.4,
            maxWidth: "780px",
            textAlign: "center",
          }}
        >
          {siteConfig.description}
        </span>
      </div>

      <div
        style={{
          ...cardBase,
          backgroundColor: tokens.surfaceBack,
          borderLeft: `1px solid ${tokens.borderBack}`,
          borderRight: `1px solid ${tokens.borderBack}`,
          borderTop: `1px solid ${tokens.borderBack}`,
          left: 196,
          right: 196,
          top: CARD_TOP - 20,
        }}
      />
      <div
        style={{
          ...cardBase,
          backgroundColor: tokens.surfaceMid,
          borderLeft: `1px solid ${tokens.borderMid}`,
          borderRight: `1px solid ${tokens.borderMid}`,
          borderTop: `1px solid ${tokens.borderMid}`,
          left: 178,
          right: 178,
          top: CARD_TOP - 10,
        }}
      />

      <div
        style={{
          ...cardBase,
          alignItems: "center",
          backgroundColor: tokens.surface,
          borderLeft: `1px solid ${tokens.border}`,
          borderRight: `1px solid ${tokens.border}`,
          borderTop: `1px solid ${tokens.border}`,
          display: "flex",
          flexDirection: "column",
          gap: "18px",
          left: 160,
          padding: "26px 40px 0",
          right: 160,
          top: CARD_TOP,
        }}
      >
        <div style={{ alignItems: "flex-end", display: "flex", gap: "32px" }}>
          {STRIPS.map(([angle, pos], i) => (
            <div
              key={String(i)}
              style={{
                alignItems: "center",
                display: "flex",
                flexDirection: "column",
                gap: "14px",
              }}
            >
              <Knob angle={angle} />
              <Fader pos={pos} />
            </div>
          ))}

          <div
            style={{
              backgroundColor: tokens.border,
              height: "182px",
              width: "1px",
            }}
          />

          <XYPad x={0.62} y={0.4} />
        </div>

        <Transport progress={0.38} />
      </div>
    </div>
  );
}

function DocsWaveform() {
  const W = 1040;
  const H = 260;
  const bars = 90;
  const barW = 7;
  const gap = (W - bars * barW) / (bars - 1);

  const heights = Array.from({ length: bars }, (_, i) => {
    const t = i / bars;
    const wave =
      Math.sin(t * Math.PI * 3.5) * 0.38 +
      Math.sin(t * Math.PI * 8.1) * 0.22 +
      Math.sin(t * Math.PI * 14.7) * 0.12 +
      0.55;
    return Math.max(0.08, Math.min(1, wave));
  });

  return (
    <svg
      aria-hidden="true"
      height={H}
      style={{ display: "block", width: "100%" }}
      viewBox={`0 0 ${W} ${H}`}
      width="100%"
    >
      {heights.map((h, i) => (
        <rect
          fill={tokens.borderMid}
          height={Math.round(h * H)}
          key={String(i)}
          rx="3"
          width={barW}
          x={i * (barW + gap)}
          y={0}
        />
      ))}
    </svg>
  );
}

export function generateDocsOG({
  title,
  description,
}: {
  title: string;
  description?: string;
}): ReactElement {
  return (
    <div
      style={{
        backgroundColor: tokens.background,
        display: "flex",
        flexDirection: "column",
        fontFamily: "Instrument Serif, Georgia, serif",
        height: "100%",
        overflow: "hidden",
        padding: "72px 80px",
        position: "relative",
        width: "100%",
      }}
    >
      <div
        style={{
          display: "flex",
          height: "260px",
          left: 0,
          overflow: "hidden",
          position: "absolute",
          right: 0,
          top: 0,
        }}
      >
        <DocsWaveform />
      </div>

      <span
        style={{
          color: tokens.foreground,
          fontSize: "88px",
          fontWeight: 700,
          letterSpacing: "-0.01em",
          lineHeight: 1,
          marginTop: "auto",
          maxWidth: "720px",
        }}
      >
        {title}
      </span>

      {description ? (
        <span
          style={{
            color: tokens.accent,
            fontSize: "26px",
            lineHeight: 1.4,
            marginTop: "20px",
            maxWidth: "680px",
          }}
        >
          {description}
        </span>
      ) : null}
    </div>
  );
}

export function makeImageResponse(
  element: ReactElement,
  fontData: ArrayBuffer | null
): ImageResponse {
  return new ImageResponse(element, {
    ...OG_SIZE,
    fonts: fontData
      ? [
          {
            data: fontData,
            name: "Instrument Serif",
            style: "normal",
            weight: 700,
          },
        ]
      : [],
  });
}
