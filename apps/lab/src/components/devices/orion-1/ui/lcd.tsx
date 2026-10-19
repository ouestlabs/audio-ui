import { CaretLeftIcon, CaretRightIcon } from "@phosphor-icons/react/ssr";

/**
 * The screen and the two buttons around it. The preset line is a status, so a
 * screen reader hears the preset change; the readout under it is for the eyes.
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
    <div className="lcd-bar">
      <button
        aria-label="Previous preset"
        className="lcd-button"
        onClick={onPrevious}
        type="button"
      >
        <CaretLeftIcon aria-hidden="true" weight="bold" />
      </button>
      <div className="lcd">
        <p className="lcd-line" role="status">
          {title}
        </p>
        <p aria-hidden="true" className="lcd-line lcd-dim">
          {readout}
        </p>
      </div>
      <button
        aria-label="Next preset"
        className="lcd-button"
        onClick={onNext}
        type="button"
      >
        <CaretRightIcon aria-hidden="true" weight="bold" />
      </button>
    </div>
  );
}
