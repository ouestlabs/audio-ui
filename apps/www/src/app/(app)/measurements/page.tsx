import type { Metadata } from "next";
import { MeasurementsReport } from "@/components/measurements-report";

export const metadata: Metadata = {
  description:
    "What each audio/ui device measures, rendered in your browser against a reference: the curve it draws, the level it holds, the time it takes. A measurement, not a certification.",
  robots: { follow: false, index: false },
  title: "Measurements",
};

export default function MeasurementsPage() {
  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-4 py-10">
      <div className="flex flex-col gap-2">
        <h1 className="font-semibold text-2xl">Measurements</h1>
        <p className="text-muted-foreground text-sm">
          Each check renders the real engine of a device in an offline audio
          context, in this browser, and compares what comes out with a
          reference. Most references are the device's own: the curve its panel
          draws, the level its state asks for. That shows the panel tells the
          truth about the sound; it does not show that a device matches an
          industry standard. Two references are not ours: the response the
          browser reports for its own filters, and the reverberation time by
          Schroeder's method (ISO 3382). The tolerances are ours too. It is a
          measurement anyone can run and read, not a certification.
        </p>
      </div>
      <MeasurementsReport />
    </div>
  );
}
