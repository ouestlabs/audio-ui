import { ImageResponse } from "next/og";
import type { ReactElement } from "react";
import { appConfig } from "@/lib/config";

export const OG_SIZE = { width: 1200, height: 630 };

export const tokens = Object.freeze({
  background: "#0a0a0a",
  surface: "#1a1a1a",
  surfaceMid: "#151515",
  surfaceBack: "#111111",

  border: "#333333",
  borderMid: "#282828",
  borderBack: "#1e1e1e",

  controlTrack: "#242424",
  controlFill: "#404040",
  controlBody: "#202020",
  controlBorder: "#3a3a3a",
  controlThumb: "#303030",
  controlThumbBorder: "#505050",

  accent: "#686868",
  foreground: "#e8e8e8",
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
        width: "40px",
        height: `${trackH}px`,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        position: "relative",
      }}
    >
      <div
        style={{
          position: "absolute",
          width: "6px",
          height: `${trackH}px`,
          backgroundColor: tokens.controlTrack,
          borderRadius: "3px",
          border: `1px solid ${tokens.controlBorder}`,
          left: "17px",
        }}
      />
      <div
        style={{
          position: "absolute",
          width: "38px",
          height: "14px",
          backgroundColor: tokens.controlThumb,
          border: `1px solid ${tokens.controlThumbBorder}`,
          borderRadius: "4px",
          top: `${thumbTop}px`,
          left: "1px",
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
        width: `${w}px`,
        height: "5px",
        backgroundColor: tokens.controlTrack,
        borderRadius: "999px",
        display: "flex",
        position: "relative",
      }}
    >
      <div
        style={{
          width: `${thumbX}px`,
          height: "100%",
          backgroundColor: tokens.controlFill,
          borderRadius: "999px",
        }}
      />
      <div
        style={{
          position: "absolute",
          width: "8px",
          height: "8px",
          borderRadius: "50%",
          backgroundColor: tokens.accent,
          border: `1px solid ${tokens.controlThumbBorder}`,
          top: "-2px",
          left: `${thumbX - 4}px`,
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
  const cardBase = Object.freeze({
    position: "absolute",
    bottom: 0,
    borderTopLeftRadius: "18px",
    borderTopRightRadius: "18px",
  });

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        backgroundColor: tokens.background,
        fontFamily: "Instrument Serif, Georgia, serif",
        overflow: "hidden",
        position: "relative",
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          paddingTop: "68px",
          gap: "14px",
        }}
      >
        <span
          style={{
            fontSize: "88px",
            fontWeight: 700,
            color: tokens.foreground,
            lineHeight: 1,
            letterSpacing: "-0.01em",
          }}
        >
          {appConfig.name}
        </span>
        <span
          style={{
            fontSize: "26px",
            color: tokens.accent,
            letterSpacing: "0.01em",
            maxWidth: "780px",
            textAlign: "center",
            lineHeight: 1.4,
          }}
        >
          {appConfig.description}
        </span>
      </div>

      <div
        style={{
          ...cardBase,
          top: CARD_TOP - 20,
          left: 196,
          right: 196,
          backgroundColor: tokens.surfaceBack,
          borderTop: `1px solid ${tokens.borderBack}`,
          borderLeft: `1px solid ${tokens.borderBack}`,
          borderRight: `1px solid ${tokens.borderBack}`,
        }}
      />
      <div
        style={{
          ...cardBase,
          top: CARD_TOP - 10,
          left: 178,
          right: 178,
          backgroundColor: tokens.surfaceMid,
          borderTop: `1px solid ${tokens.borderMid}`,
          borderLeft: `1px solid ${tokens.borderMid}`,
          borderRight: `1px solid ${tokens.borderMid}`,
        }}
      />

      <div
        style={{
          ...cardBase,
          top: CARD_TOP,
          left: 160,
          right: 160,
          backgroundColor: tokens.surface,
          borderTop: `1px solid ${tokens.border}`,
          borderLeft: `1px solid ${tokens.border}`,
          borderRight: `1px solid ${tokens.border}`,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          padding: "26px 40px 0",
          gap: "18px",
        }}
      >
        <div style={{ display: "flex", alignItems: "flex-end", gap: "32px" }}>
          {STRIPS.map(([angle, pos], i) => (
            <div
              key={String(i)}
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: "14px",
              }}
            >
              <Knob angle={angle} />
              <Fader pos={pos} />
            </div>
          ))}

          <div
            style={{
              width: "1px",
              height: "182px",
              backgroundColor: tokens.border,
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
      style={{ width: "100%", display: "block" }}
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
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        backgroundColor: tokens.background,
        fontFamily: "Instrument Serif, Georgia, serif",
        position: "relative",
        overflow: "hidden",
        padding: "72px 80px",
      }}
    >
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: "260px",
          overflow: "hidden",
          display: "flex",
        }}
      >
        <DocsWaveform />
      </div>

      <span
        style={{
          fontSize: "88px",
          fontWeight: 700,
          color: tokens.foreground,
          lineHeight: 1,
          letterSpacing: "-0.01em",
          maxWidth: "720px",
          marginTop: "auto",
        }}
      >
        {title}
      </span>

      {description ? (
        <span
          style={{
            fontSize: "26px",
            color: tokens.accent,
            maxWidth: "680px",
            lineHeight: 1.4,
            marginTop: "20px",
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
            name: "Instrument Serif",
            data: fontData,
            style: "normal",
            weight: 700,
          },
        ]
      : [],
  });
}
