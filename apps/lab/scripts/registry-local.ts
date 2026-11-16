/**
 * Installs registry items from this checkout's build of the registry instead
 * of the deployed one: what the DAW needs while a fix to the registry is not
 * merged yet. It serves `apps/www/public` (run `bun run registry:build` in
 * apps/www first), points `components.json` at it for the time of one
 * `shadcn add`, then puts it back as it was.
 *
 *   bun run registry:local arrangement-engine timeline
 *
 * Once the fix is deployed, `bunx shadcn@latest add @audio-ui/<name>` from
 * production must write the same files.
 */
const PORT = 4100;
const ROOT = `${import.meta.dir}/../../www/public`;
const CONFIG = `${import.meta.dir}/../components.json`;
const DEPLOYED = "https://www.audio-ui.dev/r/{style}/{name}.json";

const names = process.argv.slice(2);
if (names.length === 0) {
  console.error("Name the items to install: bun run registry:local <name>…");
  process.exit(1);
}

const server = Bun.serve({
  fetch: async (request) => {
    const file = Bun.file(`${ROOT}${new URL(request.url).pathname}`);
    return (await file.exists())
      ? new Response(file)
      : new Response("Not found", { status: 404 });
  },
  port: PORT,
});
const original = await Bun.file(CONFIG).text();
if (!original.includes(DEPLOYED)) {
  console.error(`components.json does not name ${DEPLOYED}`);
  process.exit(1);
}
await Bun.write(
  CONFIG,
  original.replace(
    DEPLOYED,
    `http://localhost:${PORT}/r/styles/{style}/{name}.json`
  )
);
try {
  const items = names.map((name) =>
    name.startsWith("@") ? name : `@audio-ui/${name}`
  );
  await Bun.$`bunx shadcn@latest add ${items} --yes --overwrite`.cwd(
    `${import.meta.dir}/..`
  );
} finally {
  await Bun.write(CONFIG, original);
  server.stop(true);
}
