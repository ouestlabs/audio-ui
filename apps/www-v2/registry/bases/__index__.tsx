import type * as React from "react";

/**
 * Generated registry index — placeholder.
 *
 * The fork copy shipped without this generated artifact. It is consumed by
 * `app/(create)/lib/api.ts` (per-base item lookup for the customizer).
 * Plan 002 regenerates it from the audio registry via `registry:generate`;
 * until then the customizer sees an empty index and degrades gracefully.
 */

export type RegistryIndexEntry = {
  name: string;
  type: string;
  component: React.ComponentType | null;
  [key: string]: unknown;
};

export const Index: Record<string, Record<string, RegistryIndexEntry>> = {
  radix: {},
  base: {},
};
