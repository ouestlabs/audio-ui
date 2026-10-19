import { createFileRoute, Link } from "@tanstack/react-router";
import { EXAMPLES } from "../examples.ts";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-8 p-10">
      <h1 className="font-semibold text-2xl">Lab</h1>
      <p className="text-white/60">
        Examples built with audio/ui, running on the sources of this repository.
      </p>
      <ul className="grid gap-3">
        {EXAMPLES.map((example) => (
          <li key={example.to}>
            <Link
              className="block rounded-lg border border-white/10 p-4 transition-colors hover:bg-white/5"
              to={example.to}
            >
              <span className="block font-medium">{example.title}</span>
              <span className="block text-sm text-white/60">
                {example.description}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
