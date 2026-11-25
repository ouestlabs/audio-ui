import { type ComponentType, createContext, useContext } from "react";
import type { FaderProps } from "@/registry/bases/shared/audio-ui/elements/fader";
import type { KnobProps } from "@/registry/bases/shared/audio-ui/elements/knob";

/** The controls a device panel draws, where a skin has its own. One left out is the element's. */
export interface DeviceFaces {
  Fader?: ComponentType<FaderProps>;
  Knob?: ComponentType<KnobProps>;
}

const DeviceFacesContext = createContext<DeviceFaces>({});

/** Gives every device panel below it other faces: what a skin does. A face keeps its element's props, so no panel changes. */
export const DeviceFacesProvider = DeviceFacesContext.Provider;

export function useDeviceFaces() {
  return useContext(DeviceFacesContext);
}
