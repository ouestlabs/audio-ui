import { type Algorithm, OPERATORS } from "../audio/algorithms";

/** The diagram's grid: an operator's box, how far apart the columns and rows sit, and the size of the drawing. */
const BOX = { height: 9, width: 11 };
const COLUMN = 16;
const ROW = 12;
const WIDTH = 66;
const HEIGHT = 54;
/** Above the top box, room for the feedback loop; under the carriers, for the bus. */
const LOOP = 3;
const BUS = 5;

/**
 * The algorithm as the panel's chart draws it: a box per operator, a line from
 * each modulator down to the one it bends, the carriers on a bus at the bottom,
 * and operator 4's feedback loop. One scale for every algorithm, centered.
 */
function Diagram({ algorithm }: { algorithm: Algorithm }) {
  const columns = Math.max(...OPERATORS.map((op) => algorithm.at[op][0])) + 1;
  const rows = Math.max(...OPERATORS.map((op) => algorithm.at[op][1])) + 1;
  const left = (WIDTH - (columns - 1) * COLUMN - BOX.width) / 2;
  const tall = LOOP + (rows - 1) * ROW + BOX.height + BUS;
  const bottom = (HEIGHT - tall) / 2 + tall - BUS;
  const box = (operator: (typeof OPERATORS)[number]) => {
    const [column, row] = algorithm.at[operator];
    return { x: left + column * COLUMN, y: bottom - BOX.height - row * ROW };
  };
  const carriers = algorithm.carriers.map(box);
  const four = box(4);
  return (
    <svg
      aria-hidden="true"
      className="nova-diagram"
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
    >
      {algorithm.links.map(([from, to]) => {
        const a = box(from);
        const b = box(to);
        return (
          <line
            key={`${from}-${to}`}
            x1={a.x + BOX.width / 2}
            x2={b.x + BOX.width / 2}
            y1={a.y + BOX.height}
            y2={b.y}
          />
        );
      })}
      {carriers.map((at) => (
        <line
          key={at.x}
          x1={at.x + BOX.width / 2}
          x2={at.x + BOX.width / 2}
          y1={at.y + BOX.height}
          y2={bottom + BUS - 1}
        />
      ))}
      <line
        x1={(carriers[0]?.x ?? 0) + BOX.width / 2}
        x2={(carriers.at(-1)?.x ?? 0) + BOX.width / 2}
        y1={bottom + BUS - 1}
        y2={bottom + BUS - 1}
      />
      <path
        d={`M${four.x + BOX.width} ${four.y + BOX.height / 2} h3 v-${BOX.height / 2 + 2} h-${BOX.width / 2 + 3} v2`}
        fill="none"
      />
      {OPERATORS.map((operator) => {
        const at = box(operator);
        return (
          <g key={operator}>
            <rect
              data-carrier={algorithm.carriers.includes(operator) || undefined}
              height={BOX.height}
              width={BOX.width}
              x={at.x}
              y={at.y}
            />
            <text x={at.x + BOX.width / 2} y={at.y + BOX.height - 2}>
              {operator}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

/** The screen: the voice's name, what the last control read, and the algorithm drawn. The name is a status, so a screen reader hears the voice change. */
export function Lcd({
  algorithm,
  readout,
  title,
}: {
  algorithm: Algorithm;
  readout: string;
  title: string;
}) {
  return (
    <div className="nova-lcd">
      <div className="nova-lcd-text">
        <p className="nova-lcd-line" role="status">
          {title}
        </p>
        <p aria-hidden="true" className="nova-lcd-line nova-lcd-dim">
          {readout}
        </p>
      </div>
      <Diagram algorithm={algorithm} />
    </div>
  );
}
