import { Link } from "@tanstack/react-router";
import { DEVICES } from "../../devices.ts";

export function Sidebar() {
  return (
    <nav
      aria-label="Devices"
      className="flex w-56 shrink-0 flex-col gap-6 border-white/10 border-r p-5"
    >
      <Link className="font-semibold text-sm tracking-wide" to="/">
        audio/ui lab
      </Link>
      <ul className="flex flex-col gap-1">
        {DEVICES.map((device) => (
          <li key={device.slug}>
            <Link
              activeProps={{ className: "bg-white/10 text-white" }}
              className="block rounded-md px-3 py-2 text-sm text-white/60 transition-colors hover:text-white"
              params={{ device: device.slug }}
              to="/$device"
            >
              {device.title}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
