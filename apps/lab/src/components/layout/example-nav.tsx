import { Link } from "@tanstack/react-router";
import { EXAMPLES } from "../../examples.ts";

export function ExampleNav() {
  return (
    <nav
      aria-label="Examples"
      className="flex w-56 shrink-0 flex-col gap-6 border-white/10 border-r p-5"
    >
      <Link className="font-semibold text-sm tracking-wide" to="/">
        audio/ui lab
      </Link>
      <ul className="flex flex-col gap-1">
        {EXAMPLES.map((example) => (
          <li key={example.to}>
            <Link
              activeProps={{ className: "bg-white/10 text-white" }}
              className="block rounded-md px-3 py-2 text-sm text-white/60 transition-colors hover:text-white"
              to={example.to}
            >
              {example.title}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
