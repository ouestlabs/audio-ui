import { Link } from "@tanstack/react-router";
import { highlightedElements } from "@/components/code/block/highlighted-code";
import { CopyButton } from "@/components/code/copy/copy-button";
import { Command } from "@/components/docs/mdx/install";
import { useFramework } from "@/hooks/use-framework";
import {
  audioJsUrl,
  type Entry as EntryData,
  entryOf,
  entryUrl,
  importLine,
  moduleOf,
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
    return <span className="text-muted-foreground">Nothing</span>;
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

/** Rows of facts about an entry, a label each. */
function Facts({ rows }: { rows: [string, React.ReactNode][] }) {
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

/** The audio.js packages a module builds on, each a link to its page on audio.js.org. */
function AudioJs({ names }: { names: readonly string[] }) {
  return names.map((name, index) => (
    <span key={name}>
      {index > 0 ? ", " : null}
      <a href={audioJsUrl(name)} rel="noreferrer" target="_blank">
        <code>{name}</code>
      </a>
    </span>
  ));
}

// A summary's code spans, as JSDoc writes them: `name`.
const CODE_SPAN = /(`[^`]+`)/;

/** A JSDoc sentence with its code spans drawn as code. */
function Summary({ text }: { text: string }) {
  // Keyed by where each piece starts: a sentence can quote the same name twice.
  let at = 0;
  return text.split(CODE_SPAN).map((piece) => {
    const start = at;
    at += piece.length;
    return piece.startsWith("`") ? (
      <code key={start}>{piece.slice(1, -1)}</code>
    ) : (
      piece
    );
  });
}

/** What a module exports, each with the first sentence of its JSDoc. */
function Exports({ exports }: { exports: EntryData["exports"] }) {
  // A module of types only, such as a framework's template types, exports nothing to list.
  if (exports.length === 0) {
    return null;
  }
  return (
    <table>
      <thead>
        <tr>
          <th>Export</th>
          <th>Kind</th>
          <th>What it is</th>
        </tr>
      </thead>
      <tbody>
        {exports.map((each) => (
          <tr key={each.name}>
            <td>
              <code>{each.name}</code>
            </td>
            <td>{each.kind}</td>
            <td>
              <Summary text={each.summary} />
            </td>
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
      <Facts
        rows={[
          ["Files", <Items key="files" names={entry.files} />],
          [
            "Depends on",
            <Items key="deps" names={entry.registryDependencies} />,
          ],
          ["npm", <Items key="npm" names={entry.dependencies} />],
          ["Used by", <Items key="used" names={entry.usedBy} />],
        ]}
      />
      <Exports exports={entry.exports} />
    </>
  );
}

/**
 * The head of a published module's page, such as `@audio-ui/engine/time`,
 * read from the package and its sources: the install, the import, the
 * adapters that draw it, the registry's hooks and libs that build on it, the
 * audio.js packages it is built on, and what it exports. The adapters and
 * the registry follow the reader's framework.
 */
export function Module({ from }: { from: string }) {
  const packageModule = moduleOf(from);
  // The reader's framework: React's adapter for React, the elements' for the others; the registry's users, React's alone.
  const [framework] = useFramework();
  const adapterOf =
    framework === "react" ? "@audio-ui/react" : "@audio-ui/elements";
  const adapters = framework
    ? packageModule.adapters.filter((name) => name.startsWith(adapterOf))
    : packageModule.adapters;
  const usedBy = framework && framework !== "react" ? [] : packageModule.usedBy;
  return (
    <>
      <Command code={`npm install ${packageModule.package}`} />
      <Code code={importLine(packageModule)} />
      <Facts
        rows={[
          ...(adapters.length > 0
            ? ([["Adapters", <Items key="adapters" names={adapters} />]] as [
                string,
                React.ReactNode,
              ][])
            : []),
          ...(usedBy.length > 0
            ? ([["Used by", <Items key="used" names={usedBy} />]] as [
                string,
                React.ReactNode,
              ][])
            : []),
          ...(packageModule.audiojs.length > 0
            ? ([
                [
                  "audio.js",
                  <AudioJs key="audiojs" names={packageModule.audiojs} />,
                ],
              ] as [string, React.ReactNode][])
            : []),
        ]}
      />
      <Exports exports={packageModule.exports} />
    </>
  );
}
