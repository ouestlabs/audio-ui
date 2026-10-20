import { CaretLeftIcon, CaretRightIcon } from "@phosphor-icons/react/ssr";
import type { ReactNode } from "react";

/**
 * The screen and the two keys around it. The sample's name is a status, so a
 * screen reader hears the sample change; the readout beside it is for the
 * eyes. The waveform goes under them.
 */
export function Lcd({
  children,
  onNext,
  onPrevious,
  readout,
  title,
}: {
  children: ReactNode;
  onNext: () => void;
  onPrevious: () => void;
  readout: string;
  title: string;
}) {
  return (
    <div className="altair-lcd-bar">
      <button
        aria-label="Previous sample"
        className="altair-lcd-button"
        onClick={onPrevious}
        type="button"
      >
        <CaretLeftIcon aria-hidden="true" weight="bold" />
      </button>
      <div className="altair-lcd">
        <div className="altair-lcd-lines">
          <p className="altair-lcd-line" role="status">
            {title}
          </p>
          <p aria-hidden="true" className="altair-lcd-line altair-lcd-dim">
            {readout}
          </p>
        </div>
        {children}
      </div>
      <button
        aria-label="Next sample"
        className="altair-lcd-button"
        onClick={onNext}
        type="button"
      >
        <CaretRightIcon aria-hidden="true" weight="bold" />
      </button>
    </div>
  );
}
