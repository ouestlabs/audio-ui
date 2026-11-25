import { useEffect, useRef } from "react";
import { drawPanel } from "./ui/panel";
import { usePolaris } from "./use-polaris";

/**
 * Polaris-1: the page. The panel inside it is not React: `ui/panel.ts` draws
 * it from the device's description with the knob's custom elements, as a
 * plugin's web view would. The sound is `audio/kernel.js`, compiled to
 * WebAssembly by jz.
 */
export default function Polaris1() {
  const polaris = usePolaris();
  const panel = useRef<HTMLDivElement>(null);
  const onParam = useRef(polaris.onParam);
  onParam.current = polaris.onParam;
  const initial = useRef(polaris.settings);

  useEffect(() => {
    const root = panel.current;
    if (!root) {
      return;
    }
    return drawPanel(root, initial.current, (id, value) =>
      onParam.current(id, value)
    );
  }, []);

  return (
    <div className="polaris-cabinet">
      <div className="polaris">
        <header className="polaris-header">
          <div>
            <h1 className="polaris-name">
              Polaris<span>-1</span>
            </h1>
            <p className="polaris-tagline">WebAssembly drive</p>
          </div>
          <button
            aria-pressed={polaris.playing}
            className="polaris-play"
            disabled={!polaris.ready}
            onClick={polaris.toggle}
            type="button"
          >
            <span
              aria-hidden="true"
              className="polaris-lamp"
              data-on={polaris.playing || undefined}
            />
            {polaris.playing ? "Stop" : "Play"}
          </button>
        </header>
        <div className="polaris-panel" ref={panel} />
        <p className="polaris-note">
          One JavaScript file, compiled to WebAssembly by jz. The knobs are
          drawn from the device's description.
        </p>
      </div>
    </div>
  );
}
