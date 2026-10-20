/** The screen: the patch's name, and what the last control read. The name is a status, so a screen reader hears the patch change. */
export function Lcd({ readout, title }: { readout: string; title: string }) {
  return (
    <div className="lyra-lcd">
      <p className="lyra-lcd-line" role="status">
        {title}
      </p>
      <p aria-hidden="true" className="lyra-lcd-line lyra-lcd-dim">
        {readout}
      </p>
    </div>
  );
}
