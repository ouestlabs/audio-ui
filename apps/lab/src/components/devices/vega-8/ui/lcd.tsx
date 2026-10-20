import { CaretLeftIcon, CaretRightIcon } from "@phosphor-icons/react/ssr";

/**
 * The screen and the two buttons around it. The pattern line is a status, so a
 * screen reader hears the pattern change; the readout under it is for the eyes.
 */
export function Lcd({
  onNext,
  onPrevious,
  readout,
  title,
}: {
  onNext: () => void;
  onPrevious: () => void;
  readout: string;
  title: string;
}) {
  return (
    <div className="vega-lcd-bar">
      <button
        aria-label="Previous pattern"
        className="vega-lcd-button"
        onClick={onPrevious}
        type="button"
      >
        <CaretLeftIcon aria-hidden="true" weight="bold" />
      </button>
      <div className="vega-lcd">
        <p className="vega-lcd-line" role="status">
          {title}
        </p>
        <p aria-hidden="true" className="vega-lcd-line vega-lcd-dim">
          {readout}
        </p>
      </div>
      <button
        aria-label="Next pattern"
        className="vega-lcd-button"
        onClick={onNext}
        type="button"
      >
        <CaretRightIcon aria-hidden="true" weight="bold" />
      </button>
    </div>
  );
}
