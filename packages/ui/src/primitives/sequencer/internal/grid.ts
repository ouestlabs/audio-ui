export type Pattern = readonly (readonly boolean[])[];

export interface CellAddress {
  row: number;
  step: number;
}

/** `pattern` with one cell set; the same pattern when it already is. */
export function setCell(
  pattern: Pattern,
  { row, step }: CellAddress,
  on: boolean
): boolean[][] {
  return pattern.map((cells, at) =>
    at === row
      ? cells.map((cell, index) => (index === step ? on : cell))
      : [...cells]
  );
}

/** Whether `pattern` has the cell on. A cell outside it is off. */
export function isOn(pattern: Pattern, { row, step }: CellAddress): boolean {
  return pattern[row]?.[step] === true;
}

/** Where an arrow, Home or End key takes the focus from `from`, kept inside the grid. */
export function moveFocus(
  from: CellAddress,
  key: string,
  rows: number,
  steps: number,
  ctrlKey: boolean
): CellAddress | null {
  const last = { row: Math.max(0, rows - 1), step: Math.max(0, steps - 1) };
  switch (key) {
    case "ArrowLeft":
      return { ...from, step: Math.max(0, from.step - 1) };
    case "ArrowRight":
      return { ...from, step: Math.min(last.step, from.step + 1) };
    case "ArrowUp":
      return { ...from, row: Math.max(0, from.row - 1) };
    case "ArrowDown":
      return { ...from, row: Math.min(last.row, from.row + 1) };
    case "Home":
      return ctrlKey ? { row: 0, step: 0 } : { ...from, step: 0 };
    case "End":
      return ctrlKey ? last : { ...from, step: last.step };
    default:
      return null;
  }
}

/** The cell whose box holds the point, from the boxes of every cell. */
export function cellAtPoint(
  boxes: Iterable<readonly [string, DOMRect]>,
  clientX: number,
  clientY: number
): CellAddress | null {
  for (const [key, box] of boxes) {
    if (
      clientX >= box.left &&
      clientX < box.right &&
      clientY >= box.top &&
      clientY < box.bottom
    ) {
      const [row, step] = key.split(":").map(Number);
      return { row: row ?? 0, step: step ?? 0 };
    }
  }
  return null;
}

export const cellKey = ({ row, step }: CellAddress) => `${row}:${step}`;
