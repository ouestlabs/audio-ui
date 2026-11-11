import { Link } from "@tanstack/react-router";
import { highlightedElements } from "@/components/code/block/highlighted-code";
import { CopyButton } from "@/components/code/copy/copy-button";
import { Command } from "@/components/docs/mdx/install";
import {
  type Entry as EntryData,
  entryOf,
  entryUrl,
  importLine,
  sourceUrl,
} from "@/lib/docs/content/entries";

/** A line of TypeScript as the page's fences draw it. */
function Code({ code }: { code: string }) {
  const { elements } = highlightedElements(code, "ts", false);
  return (
    <figure className="" data-not-typeset="" data-rehype-pretty-code-figure="">
      <pre
        className="scrollbar-y min-w-0 overflow-x-auto px-4 py-3.5 outline-none th-code th-code--ts"
        data-language="ts"
      >
        <CopyButton value={code} />
        <code>{elements}</code>
      </pre>
    </figure>
  );
}

/** Items by name, each a link to its entry when it has one. */
function Items({ names }: { names: readonly string[] }) {
  if (names.length === 0) {
    return <span className="text-site-muted-foreground">Nothing</span>;
  }
  return (
    <>
      {names.map((name, index) => {
        const url = entryUrl(name);
        return (
          <span key={name}>
            {index > 0 ? ", " : null}
            {url ? (
              <Link to={url}>
                <code>{name}</code>
              </Link>
            ) : (
              <code>{name}</code>
            )}
          </span>
        );
      })}
    </>
  );
}

/** What an entry is made of and part of: its files, what it needs, what needs it, its source. */
function Overview({ entry }: { entry: EntryData }) {
  const rows: [string, React.ReactNode][] = [
    ["Files", <Items key="files" names={entry.files} />],
    ["Depends on", <Items key="deps" names={entry.registryDependencies} />],
    ["npm", <Items key="npm" names={entry.dependencies} />],
    ["Used by", <Items key="used" names={entry.usedBy} />],
    [
      "Source",
      entry.sources.map((path, index) => (
        <span key={path}>
          {index > 0 ? ", " : null}
          <a href={sourceUrl(path)} rel="noreferrer" target="_blank">
            {path.split("/").at(-1)}
          </a>
        </span>
      )),
    ],
  ];
  return (
    <table>
      <tbody>
        {rows.map(([label, value]) => (
          <tr key={label}>
            <th className="w-32 text-left font-medium" scope="row">
              {label}
            </th>
            <td>{value}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/**
 * The head of a hook's or a lib's page, read from the registry and its
 * source: how it installs and is imported, what it is made of and part of,
 * and what it exports, each export with the first sentence of its JSDoc.
 * What follows it on the page is written: what it is for, how to use it.
 */
export function Entry({ name }: { name: string }) {
  const entry = entryOf(name);
  return (
    <>
      <Command code={`npx shadcn@latest add @audio-ui/${entry.name}`} />
      <Code code={importLine(entry)} />
      <Overview entry={entry} />
      <table>
        <thead>
          <tr>
            <th>Export</th>
            <th>Kind</th>
            <th>What it is</th>
          </tr>
        </thead>
        <tbody>
          {entry.exports.map((each) => (
            <tr key={each.name}>
              <td>
                <code>{each.name}</code>
              </td>
              <td>{each.kind}</td>
              <td>{each.summary}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}
