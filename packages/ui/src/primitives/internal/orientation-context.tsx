import * as React from "react";

export type Orientation = "vertical" | "horizontal";

const OrientationContext = React.createContext<Orientation | undefined>(
  undefined
);

export function OrientationProvider({
  children,
  value,
}: {
  children: React.ReactNode;
  value: Orientation | undefined;
}) {
  return (
    <OrientationContext.Provider value={value}>
      {children}
    </OrientationContext.Provider>
  );
}

export function useInheritedOrientation() {
  return React.useContext(OrientationContext);
}
