import { namesOf, registryItemRows } from "@/lib/docs/content/registry-items";

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
              <code>{`@audio-ui/${row.name}`}</code>
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
