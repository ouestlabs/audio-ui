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
    <div className="mira-lcd-bar">
      <button
        aria-label="Previous pattern"
        className="mira-lcd-button"
        onClick={onPrevious}
        type="button"
      >
        <CaretLeftIcon aria-hidden="true" weight="bold" />
      </button>
      <div className="mira-lcd">
        <p className="mira-lcd-line" role="status">
          {title}
        </p>
        <p aria-hidden="true" className="mira-lcd-line mira-lcd-dim">
          {readout}
        </p>
      </div>
      <button
        aria-label="Next pattern"
        className="mira-lcd-button"
        onClick={onNext}
        type="button"
      >
        <CaretRightIcon aria-hidden="true" weight="bold" />
      </button>
    </div>
  );
}
