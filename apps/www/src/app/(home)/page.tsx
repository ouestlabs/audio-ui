import { DemoGrid } from "@/app/(home)/elements/demo-grid";
import { Hero } from "@/app/(home)/elements/hero";

export default function IndexPage() {
  return (
    <div className="flex flex-1 flex-col">
      <Hero />
      <div className="container-wrapper flex flex-1 flex-col pb-6">
        <div className="theme-container container flex flex-1 flex-col">
          <DemoGrid />
        </div>
      </div>
    </div>
  );
}
