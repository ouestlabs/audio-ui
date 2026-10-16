import type { Metadata } from "next";
import { ConformanceReport } from "@/components/conformance-report";

export const metadata: Metadata = {
  description:
    "What each audio/ui device measures, rendered in your browser against a reference: the curve it draws, the level it holds, the time it takes.",
  robots: { follow: false, index: false },
  title: "Conformance",
};

export default function ConformancePage() {
  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-4 py-10">
      <div className="flex flex-col gap-2">
        <h1 className="font-semibold text-2xl">Conformance</h1>
        <p className="text-muted-foreground text-sm">
          Each check renders the real engine of a device in an offline audio
          context, in this browser, and compares what comes out with a
          reference: the curve its panel draws, the level it should hold, the
          time it should take. Nothing here is a certification: it is a
          measurement anyone can run and read.
        </p>
      </div>
      <ConformanceReport />
    </div>
  );
}
