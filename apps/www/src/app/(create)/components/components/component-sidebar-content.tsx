"use client";

import * as React from "react";

import { ComponentSidebarCategoryMenu } from "./component-sidebar-category-menu";

interface ComponentSidebarContentProps {
  onSelect?: () => void;
  filter?: string;
  view?: "list" | "compact";
}

export const ComponentSidebarContent = React.memo(
  function _ComponentSidebarContent({
    onSelect,
    filter = "",
    view = "list",
  }: ComponentSidebarContentProps) {
    return (
      <div className="flex flex-col overflow-hidden">
        <div className="no-scrollbar scroll-fade-y h-[calc(100vh-135px)] overflow-y-auto px-2.5">
          <div className="flex-1 overflow-y-auto pt-2">
            <ComponentSidebarCategoryMenu
              filter={filter}
              onSelect={onSelect}
              view={view}
            />
          </div>
        </div>
      </div>
    );
  }
);
