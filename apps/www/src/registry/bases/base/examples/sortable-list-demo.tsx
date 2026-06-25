"use client";

import { useState } from "react";
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemTitle,
} from "@/registry/bases/base/ui/item";
import {
  SortableDragHandle,
  SortableItem,
  SortableList,
} from "@/registry/bases/base/ui/sortable-list";

const initialItems = [
  {
    id: "1",
    title: "Item 1",
    description: "Description for item 1",
  },
  {
    id: "2",
    title: "Item 2",
    description: "Description for item 2",
  },
  {
    id: "3",
    title: "Item 3",
    description: "Description for item 3",
  },
  {
    id: "4",
    title: "Item 4",
    description: "Description for item 4",
  },
];

export default function SortableListDemo() {
  const [items, setItems] = useState(initialItems);

  return (
    <SortableList
      className="w-full gap-1"
      items={items}
      onChange={setItems}
      renderItem={(item) => (
        <SortableItem id={item.id}>
          <Item className="w-full border-border" size="sm" variant="muted">
            <ItemActions>
              <SortableDragHandle />
            </ItemActions>
            <ItemContent>
              <ItemTitle>{item.title}</ItemTitle>
              <ItemDescription>{item.description}</ItemDescription>
            </ItemContent>
          </Item>
        </SortableItem>
      )}
    />
  );
}
