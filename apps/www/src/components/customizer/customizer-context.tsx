import { createContext, use } from "react";

export interface CustomizerContextValue {
  customizerOpen: boolean;
  setCustomizerOpen: (open: boolean) => void;
  toggleCustomizer: () => void;
}

export const CustomizerContext = createContext<CustomizerContextValue | null>(
  null
);

export function useCustomizer() {
  const context = use(CustomizerContext);
  if (!context) {
    throw new Error("useCustomizer must be used within a FramedLayout");
  }
  return context;
}
