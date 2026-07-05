import { Box, Component, Layers, Server } from "lucide-react";
import { Card } from "@/components/custom/card";
import { getTotalComponentCount } from "@/lib/registry";

export function Stats() {
  const totalComponentCount = getTotalComponentCount();

  const stats = [
    {
      icon: Box,
      title: "Free & Open-Source Core",
      description:
        "The most complete open-source shadcn component library loved by devs around the world.",
    },
    {
      icon: Layers,
      title: `${totalComponentCount}+ Components`,
      description:
        "Reusable solutions composed from shadcn/ui primitives into real-world product flows.",
    },
    {
      icon: Component,
      title: "Shadcn Create Compatible",
      description:
        "All components are compatible with all 5 Shadcn Create styles and settings.",
    },
    {
      icon: Server,
      title: "Headless Primitives",
      description:
        "Unstyled, accessible primitives published as @audio-ui/react — Fader, Knob, Transport, XYPad, and ChannelStrip.",
    },
  ];

  return (
    <section className="container-wrapper py-4">
      <div className="container">
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-4">
          {stats.map((stat) => (
            <Card key={stat.title}>
              <div className="flex items-center justify-start">
                <stat.icon
                  className="size-5 text-site-foreground/70"
                  strokeWidth={1.5}
                />
              </div>
              <div className="space-y-3">
                <h3 className="font-semibold text-base text-site-foreground tracking-tight">
                  {stat.title}
                </h3>
                <p className="font-medium text-site-muted-foreground text-sm leading-relaxed">
                  {stat.description}
                </p>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}
