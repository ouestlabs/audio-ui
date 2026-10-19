import {
  hotkeysCoreFeature,
  selectionFeature,
  syncDataLoaderFeature,
} from "@headless-tree/core";
import { useTree } from "@headless-tree/react";
import { FolderIcon, FolderOpenIcon } from "@phosphor-icons/react/ssr";
import { useMemo } from "react";
import { FileType, getFileType } from "@/components/ui/file-type";
import { Tree, TreeItem, TreeItemLabel } from "@/components/ui/tree";
import type { SourceFile } from "@/lib/devices";

interface Item {
  children?: string[];
  /** The path of the file in the device's folder; folders have none. */
  file?: string;
  name: string;
}

const ROOT = "root";
const INDENT = 16;

/** The files of a device as the tree's items, by path: a folder's children, folders first, then files in the order they came. */
function buildItems(files: SourceFile[]): Record<string, Item> {
  const items: Record<string, Item> = { [ROOT]: { children: [], name: "" } };
  for (const file of files) {
    const parts = file.name.split("/");
    let parent = ROOT;
    for (const [index, part] of parts.entries()) {
      const id = parts.slice(0, index + 1).join("/");
      const last = index === parts.length - 1;
      if (!items[id]) {
        items[id] = last
          ? { file: file.name, name: part }
          : { children: [], name: part };
        items[parent]?.children?.push(id);
      }
      parent = id;
    }
  }
  for (const item of Object.values(items)) {
    item.children?.sort((a, b) => {
      const [x, y] = [items[a], items[b]];
      const folders =
        Number(Boolean(y?.children)) - Number(Boolean(x?.children));
      return folders === 0 ? 0 : folders;
    });
  }
  return items;
}

/** A folder drawn as a folder, the size of a file's icon, open when it is. */
function FolderGlyph({ open }: { open: boolean }) {
  const Icon = open ? FolderOpenIcon : FolderIcon;
  return <Icon aria-hidden className="size-6 text-amber-500" weight="fill" />;
}

/** A device's files as a tree of folders you can open, the one on show selected. */
export function FileTree({
  files,
  onSelect,
  selected,
}: {
  files: SourceFile[];
  onSelect: (path: string) => void;
  selected: string;
}) {
  const items = useMemo(() => buildItems(files), [files]);
  const folders = useMemo(
    () => Object.keys(items).filter((id) => items[id]?.children && id !== ROOT),
    [items]
  );

  const tree = useTree<Item>({
    dataLoader: {
      getChildren: (id) => items[id]?.children ?? [],
      getItem: (id) => items[id] as Item,
    },
    features: [syncDataLoaderFeature, selectionFeature, hotkeysCoreFeature],
    getItemName: (item) => item.getItemData().name,
    indent: INDENT,
    initialState: { expandedItems: folders },
    isItemFolder: (item) => Boolean(item.getItemData().children),
    // A click or Enter on a file shows it; on a folder, the tree opens or shuts it.
    onPrimaryAction: (item) => {
      const path = item.getItemData().file;
      if (path) {
        onSelect(path);
      }
    },
    rootItemId: ROOT,
    // The tree keeps the selection the dialog holds: the file on show.
    state: { selectedItems: [selected] },
  });

  return (
    <Tree indent={INDENT} tree={tree}>
      {tree.getItems().map((item) => {
        const data = item.getItemData();
        const path = data.file;
        return (
          <TreeItem item={item} key={item.getId()}>
            <TreeItemLabel>
              {path ? (
                <FileType
                  aria-hidden
                  size="xs"
                  type={getFileType(data.name)}
                  variant="outline"
                />
              ) : (
                <FolderGlyph open={item.isExpanded()} />
              )}
              <span className="truncate">{data.name}</span>
            </TreeItemLabel>
          </TreeItem>
        );
      })}
    </Tree>
  );
}
