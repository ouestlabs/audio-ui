import { TypeRow, TypeTable } from "@/components/docs/mdx/type-table";
import { eventRows, partRows, tagsOf } from "@/lib/docs/content/primitive-api";

/** What a part with no element of its own is: a provider of defaults, or a part made of others. */
const PROVIDER =
  "Gives the default options to the parts below it, and draws no element.";
const COMPOSED =
  "Made of other parts: it takes the props of the ones it places.";

const kindOf = (row: { element: string | null; name: string }) => {
  if (row.element) {
    return `<${row.element}>`;
  }
  return row.name === "Provider" ? "provider" : "composed";
};

const explain = (row: { name: string }) =>
  row.name === "Provider" ? PROVIDER : COMPOSED;

/** The parts of a primitive as the adapters of React, Vue and Svelte export them. */
export function PrimitiveParts({ name }: { name: string }) {
  const { component, rows } = partRows(name);
  return (
    <TypeTable title="Parts">
      {rows.map((row) => (
        <TypeRow
          key={row.name}
          name={`${component}.${row.name}`}
          type={kindOf(row)}
        >
          {row.props.length > 0 ? (
            <>
              Props besides the classes and attributes of its element:{" "}
              {row.props.map((prop, index) => (
                <span key={prop}>
                  {index > 0 ? ", " : ""}
                  <code>{prop}</code>
                </span>
              ))}
              .
            </>
          ) : null}
          {row.element ? null : explain(row)}
        </TypeRow>
      ))}
    </TypeTable>
  );
}

/** The events of a primitive as React and Svelte, Vue and the custom elements name them. */
export function PrimitiveEvents({ name }: { name: string }) {
  const rows = eventRows(name);
  return (
    <TypeTable title="Events">
      {rows.map((row) => (
        <TypeRow key={row.callback} name={row.callback} type={row.type}>
          Vue: <code>@{row.vue}</code>.{" "}
          {row.event ? (
            <>
              Web: the <code>{row.event}</code> event.
            </>
          ) : (
            "Web: no event."
          )}
        </TypeRow>
      ))}
    </TypeTable>
  );
}

/** The tags the web adapter of a primitive registers. */
export function PrimitiveTags({ name }: { name: string }) {
  return (
    <p>
      {tagsOf(name).map((tag, index) => (
        <span key={tag}>
          {index > 0 ? ", " : ""}
          <code>{tag}</code>
        </span>
      ))}
      .
    </p>
  );
}
