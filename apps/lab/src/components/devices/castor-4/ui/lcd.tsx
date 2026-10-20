/** The screen: the patch's name, and what the last control read. The name is a status, so a screen reader hears the patch change. */
export function Lcd({ readout, title }: { readout: string; title: string }) {
  return (
    <div className="castor-lcd">
      <p className="castor-lcd-line" role="status">
        {title}
      </p>
      <p aria-hidden="true" className="castor-lcd-line castor-lcd-dim">
        {readout}
      </p>
    </div>
  );
}
