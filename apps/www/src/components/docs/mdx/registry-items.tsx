import { Link } from "@tanstack/react-router";
import { entryUrl } from "@/lib/docs/content/entries";
import { namesOf, registryItemRows } from "@/lib/docs/content/registry-items";

/** An item's install name, a link to its entry page when it has one. */
function RowName({ name }: { name: string }) {
  const url = entryUrl(name);
  const label = <code>{`@audio-ui/${name}`}</code>;
  return url ? <Link to={url}>{label}</Link> : label;
}

/**
 * Hooks or libs of the registry as a table: each item's install name, where
 * a project imports it from, and what it does, read from the registry itself
 * so a page never says more or less than what installs.
 */
export function RegistryItems({ names }: { names: string }) {
  const rows = registryItemRows(namesOf(names));
  return (
    <table>
      <thead>
        <tr>
          <th>Install</th>
          <th>Import</th>
          <th>What it is</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.name}>
            <td>
              <RowName name={row.name} />
            </td>
            <td>
              <code>{row.from}</code>
            </td>
            <td>{row.description}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
