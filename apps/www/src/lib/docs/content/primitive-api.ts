import manifest from "@/lib/docs/content/primitive-api.generated.json";

export interface PartRow {
  /** What the part draws as, or `null` for one the adapter composes of others. */
  element: string | null;
  name: string;
  props: string[];
}

export interface EventRow {
  /** The option of React and Svelte. */
  callback: string;
  /** The event of the custom elements, or `null` when the web adapter has none. */
  event: string | null;
  type: string;
  /** The event of Vue. */
  vue: string;
}

type Primitive = (typeof manifest)[number];

const primitives = manifest as readonly Primitive[];

function primitiveOf(name: string): Primitive | undefined {
  return primitives.find((primitive) => primitive.name === name);
}

export const primitiveNames = () =>
  primitives.map((primitive) => primitive.name);

/** The parts of a primitive as every adapter exports them, with what they draw and what they take. */
export function partRows(name: string): { component: string; rows: PartRow[] } {
  const primitive = primitiveOf(name);
  return {
    component: primitive?.component ?? "",
    rows: (primitive?.parts ?? []).map((part) => ({
      element: "element" in part ? (part.element as string) : null,
      name: part.name,
      props: Object.entries(part.props as Record<string, string>).map(
        ([prop, kind]) => `${prop}: ${kind}`
      ),
    })),
  };
}

/** The tags the web adapter of a primitive registers. */
export const tagsOf = (name: string): string[] => [
  ...(primitiveOf(name)?.tags ?? []),
];

/** The events of a primitive as each framework names them. */
export function eventRows(name: string): EventRow[] {
  const primitive = primitiveOf(name);
  const types = new Map(
    (primitive?.options ?? []).map((option) => [option.name, option.type])
  );
  return (primitive?.events ?? []).map((event) => ({
    callback: event.callback,
    event: event.event,
    type: types.get(event.callback) ?? "",
    vue: event.vue,
  }));
}

const PARTS_TAG = /<PrimitiveParts\s+name="([a-z-]+)"\s*\/>/g;
const EVENTS_TAG = /<PrimitiveEvents\s+name="([a-z-]+)"\s*\/>/g;
const TAGS_TAG = /<PrimitiveTags\s+name="([a-z-]+)"\s*\/>/g;

/** What a part draws as, in a markdown table. */
function kindOfRow(row: PartRow) {
  if (row.element) {
    return `\`${row.element}\``;
  }
  return row.name === "Provider"
    ? "provider of default options"
    : "composed of other parts";
}

/** Each tag of the API reference as the table or list it stands for, for the pages served as markdown. */
export function expandPrimitiveApi(content: string) {
  return content
    .replace(PARTS_TAG, (_tag, name: string) => {
      const { component, rows } = partRows(name);
      const lines = rows.map(
        (row) =>
          `| \`${component}.${row.name}\` | ${kindOfRow(row)} | ${row.props.length > 0 ? row.props.map((prop) => `\`${prop}\``).join(", ") : ""} |`
      );
      return [
        "| Part | Element | Props |",
        "| --- | --- | --- |",
        ...lines,
      ].join("\n");
    })
    .replace(EVENTS_TAG, (_tag, name: string) => {
      const lines = eventRows(name).map(
        (row) =>
          `| \`${row.callback}\` | \`@${row.vue}\` | ${row.event ? `\`${row.event}\`` : "none"} |`
      );
      return [
        "| React and Svelte | Vue | Web |",
        "| --- | --- | --- |",
        ...lines,
      ].join("\n");
    })
    .replace(TAGS_TAG, (_tag, name: string) =>
      tagsOf(name)
        .map((tag) => `\`${tag}\``)
        .join(", ")
    );
}
