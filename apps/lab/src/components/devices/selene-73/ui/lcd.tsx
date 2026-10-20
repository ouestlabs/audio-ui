/** The screen: the patch's name, and what the last control read. The name is a status, so a screen reader hears the patch change. */
export function Lcd({ readout, title }: { readout: string; title: string }) {
  return (
    <div className="selene-lcd">
      <p className="selene-lcd-line" role="status">
        {title}
      </p>
      <p aria-hidden="true" className="selene-lcd-line selene-lcd-dim">
        {readout}
      </p>
    </div>
  );
}
