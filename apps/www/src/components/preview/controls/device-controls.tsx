import { Children, isValidElement, type ReactNode } from "react";
import { TypeRow, TypeTable } from "@/components/docs/mdx/type-table";
import {
  type DeviceDocName,
  deviceControlRows,
  ENABLED_TEXT,
} from "@/lib/docs/content/device-docs";

/** What one control does, written in the page: it goes in the row of the control with the same `id`. */
export function Control(_props: { children: ReactNode; id: string }) {
  return null;
}

/**
 * The controls of a device, one row each, with the range and the default read
 * from the device itself and what each does written in the page as `Control`
 * children. A test fails when a control has no text or a text has no control.
 */
export function DeviceControls({
  children,
  device,
}: {
  children?: ReactNode;
  device: DeviceDocName;
}) {
  const texts = new Map<string, ReactNode>();
  for (const child of Children.toArray(children)) {
    if (isValidElement<{ children: ReactNode; id: string }>(child)) {
      texts.set(child.props.id, child.props.children);
    }
  }
  return (
    <TypeTable title="Controls">
      {deviceControlRows(device).map((row) => (
        <TypeRow
          default={row.default}
          key={row.id}
          name={row.label}
          type={row.range}
        >
          {texts.get(row.id) ?? (row.id === "enabled" ? ENABLED_TEXT : null)}
        </TypeRow>
      ))}
    </TypeTable>
  );
}
