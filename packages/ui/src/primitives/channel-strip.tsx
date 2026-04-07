import type * as React from "react";
import { getDataAttributes } from "./internal/data-attributes";
import {
  type Orientation,
  OrientationProvider,
  useInheritedOrientation,
} from "./internal/orientation-context";

export namespace ChannelStrip {
  export interface RootProps extends React.ComponentProps<"section"> {
    orientation?: Orientation;
  }

  export function Root({
    children,
    orientation = "vertical",
    ...props
  }: RootProps) {
    return (
      <OrientationProvider value={orientation}>
        <section
          {...getDataAttributes("channel-strip", { part: "root", orientation })}
          {...props}
        >
          {children}
        </section>
      </OrientationProvider>
    );
  }

  export interface HeaderProps extends React.ComponentProps<"header"> {}

  export function Header({ ...props }: HeaderProps) {
    return (
      <header
        {...getDataAttributes("channel-strip", { part: "header" })}
        {...props}
      />
    );
  }

  export interface ContentProps extends React.ComponentProps<"div"> {
    layout?: "stack" | "row";
  }

  export function Content({ layout = "stack", ...props }: ContentProps) {
    return (
      <div
        {...getDataAttributes("channel-strip", { part: "content", layout })}
        {...props}
      />
    );
  }

  export interface FooterProps extends React.ComponentProps<"footer"> {}

  export function Footer({ ...props }: FooterProps) {
    return (
      <footer
        {...getDataAttributes("channel-strip", { part: "footer" })}
        {...props}
      />
    );
  }

  export interface SectionProps extends React.ComponentProps<"div"> {
    orientation?: Orientation;
  }

  export function Section({ children, orientation, ...props }: SectionProps) {
    const inheritedOrientation = useInheritedOrientation();
    const resolvedOrientation =
      orientation ?? inheritedOrientation ?? "vertical";

    return (
      <div
        {...getDataAttributes("channel-strip", {
          part: "section",
          orientation: resolvedOrientation,
        })}
        {...props}
      >
        {children}
      </div>
    );
  }

  export interface LabelProps extends React.ComponentProps<"span"> {}

  export function Label({ children, ...props }: LabelProps) {
    return (
      <span
        {...getDataAttributes("channel-strip", { part: "label" })}
        {...props}
      >
        {children}
      </span>
    );
  }

  export interface ValueProps extends React.ComponentProps<"output"> {}

  export function Value({ children, ...props }: ValueProps) {
    return (
      <output
        aria-live="polite"
        {...getDataAttributes("channel-strip", { part: "value" })}
        {...props}
      >
        {children}
      </output>
    );
  }
}
