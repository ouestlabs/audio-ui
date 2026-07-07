"use client";

import { Fragment } from "react";
import {
  AudioDemoProvider,
  catalogNeedsAudioProvider,
} from "@/components/audio-demo-provider";
import type { CatalogItem } from "../types";
import { ComponentGrid } from "./component-grid";

interface ComponentPreviewViewProps {
  catalogItems: CatalogItem[];
}

export function ComponentPreviewView({
  catalogItems,
}: ComponentPreviewViewProps) {
  const Wrapper = catalogNeedsAudioProvider(catalogItems)
    ? AudioDemoProvider
    : Fragment;

  return (
    <div className="theme-container w-full" data-slot="component-preview">
      <Wrapper>
        <ComponentGrid catalogItems={catalogItems} />
      </Wrapper>
    </div>
  );
}
