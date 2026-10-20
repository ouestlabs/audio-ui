import { createContext, type ReactNode, use, useMemo, useState } from "react";
import { usePersistedState } from "@/hooks/use-persisted-state";

interface LabState {
  commandOpen: boolean;
  /** The details aside on a wide screen: kept between visits. */
  detailsOpen: boolean;
  /** The details sheet on a narrow one: open only when asked for in this visit. */
  detailsSheetOpen: boolean;
  /** Only the device: no sidebars, to play. */
  /** The navigation sidebar: kept between visits. */
  navigationOpen: boolean;
  sourceOpen: boolean;
}

interface LabActions {
  setCommandOpen: (open: boolean) => void;
  setDetailsOpen: (open: boolean) => void;
  setNavigationOpen: (open: boolean) => void;
  setSourceOpen: (open: boolean) => void;
  toggleDetails: () => void;
}

interface Lab {
  actions: LabActions;
  state: LabState;
}

const LabContext = createContext<Lab | null>(null);

/** Whether the details are an aside (from `lg`) or a sheet: the panel's own breakpoint. */
const isWide = () => window.matchMedia("(min-width: 1024px)").matches;

/**
 * What the frame's parts share: the command menu, the details panel and the
 * source. The provider is the only place that knows how they are kept;
 * the parts read `state` and call `actions`.
 */
export function LabProvider({ children }: { children: ReactNode }) {
  const [commandOpen, setCommandOpen] = useState(false);
  const [detailsOpen, setStoredDetailsOpen] = usePersistedState(
    "lab:details",
    false
  );
  const [navigationOpen, setNavigationOpen] = usePersistedState(
    "lab:navigation",
    true
  );
  const [detailsSheetOpen, setDetailsSheetOpen] = useState(false);
  const [sourceOpen, setSourceOpen] = useState(false);

  // The setters are stable, so the actions are made once.
  const actions = useMemo<LabActions>(
    () => ({
      setCommandOpen,
      // Wide, the aside is the one kept between visits; narrow, the sheet is only ever open for the visit.
      setDetailsOpen: (open) =>
        isWide() ? setStoredDetailsOpen(open) : setDetailsSheetOpen(open),
      setNavigationOpen,
      setSourceOpen,
      toggleDetails: () =>
        isWide()
          ? setStoredDetailsOpen((open) => !open)
          : setDetailsSheetOpen((open) => !open),
    }),
    [setNavigationOpen, setStoredDetailsOpen]
  );
  const value = useMemo(
    () => ({
      actions,
      state: {
        commandOpen,
        detailsOpen,
        detailsSheetOpen,
        navigationOpen,
        sourceOpen,
      },
    }),
    [
      actions,
      commandOpen,
      detailsSheetOpen,
      detailsOpen,
      navigationOpen,
      sourceOpen,
    ]
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
