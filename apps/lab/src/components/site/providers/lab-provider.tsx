import { createContext, type ReactNode, use, useMemo, useState } from "react";

interface LabState {
  commandOpen: boolean;
  detailsOpen: boolean;
  /** Only the device: no sidebars, to play. */
  focus: boolean;
  sourceOpen: boolean;
}

interface LabActions {
  setCommandOpen: (open: boolean) => void;
  setDetailsOpen: (open: boolean) => void;
  setFocus: (focus: boolean) => void;
  setSourceOpen: (open: boolean) => void;
  toggleDetails: () => void;
  toggleFocus: () => void;
}

interface Lab {
  actions: LabActions;
  state: LabState;
}

const LabContext = createContext<Lab | null>(null);

/**
 * What the frame's parts share: the command menu, the details panel and the
 * focus mode. The provider is the only place that knows how they are kept;
 * the parts read `state` and call `actions`.
 */
export function LabProvider({ children }: { children: ReactNode }) {
  const [commandOpen, setCommandOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [focus, setFocus] = useState(false);
  const [sourceOpen, setSourceOpen] = useState(false);

  // The setters are stable, so the actions are made once.
  const actions = useMemo<LabActions>(
    () => ({
      setCommandOpen,
      setDetailsOpen,
      setFocus,
      setSourceOpen,
      toggleDetails: () => setDetailsOpen((open) => !open),
      toggleFocus: () => setFocus((on) => !on),
    }),
    []
  );
  const value = useMemo(
    () => ({ actions, state: { commandOpen, detailsOpen, focus, sourceOpen } }),
    [actions, commandOpen, detailsOpen, focus, sourceOpen]
  );

  return <LabContext value={value}>{children}</LabContext>;
}

export function useLab() {
  const value = use(LabContext);
  if (!value) {
    throw new Error("useLab needs a LabProvider");
  }
  return value;
}
