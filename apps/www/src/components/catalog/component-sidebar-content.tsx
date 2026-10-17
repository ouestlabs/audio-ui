"use client";

import * as React from "react";

import { ComponentSidebarCategoryMenu } from "./component-sidebar-category-menu";

export const ComponentSidebarContent = React.memo(
  function _ComponentSidebarContent({ onSelect }: { onSelect?: () => void }) {
    return (
      <div className="no-scrollbar scroll-fade-y min-h-0 flex-1 overflow-y-auto px-2 pt-2 pb-12">
        <ComponentSidebarCategoryMenu onSelect={onSelect} />
      </div>
    );
  }
);
