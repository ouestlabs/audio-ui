import { promises as fs } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import type { RegistryItem } from "shadcn/schema";
import { Project, ScriptKind } from "ts-morph";

import { Index } from "@/registry/__index__";

export function getRegistryComponent(name: string) {
  return Index[name]?.component;
}

export async function getRegistryItem(name: string) {
  const item = Index[name];

  if (!item) {
    return null;
  }

  // Type assertion for now - TODO: implement proper validation
  const typedItem = item as RegistryItem;

  const files = typedItem.files || [];
  const processedFiles: { path: string; content: string }[] = [];

  for (const file of files) {
    const content = await getFileContent(file);
    const relativePath = path.relative(process.cwd(), file.path);

    processedFiles.push({
      ...file,
      path: relativePath,
      content,
    });
  }

  // Fix file paths.
  const finalFiles = fixFilePaths(processedFiles);

  return {
    ...typedItem,
    files: finalFiles,
  };
}

async function getFileContent(file: { path: string; type?: string }) {
  // Resolve path relative to process.cwd()
  // Paths from index are either "src/registry/default/..." or absolute paths
  const resolvedPath = path.isAbsolute(file.path)
    ? file.path
    : path.join(process.cwd(), file.path);

  const raw = await fs.readFile(resolvedPath, "utf-8");

  const project = new Project({
    compilerOptions: {},
  });

  const tempFile = await createTempSourceFile(file.path);
  const sourceFile = project.createSourceFile(tempFile, raw, {
    scriptKind: ScriptKind.TSX,
  });

  // Remove meta variables.
  // removeVariable(sourceFile, "iframeHeight")
  // removeVariable(sourceFile, "containerClassName")
  // removeVariable(sourceFile, "description")

  let code = sourceFile.getFullText();

  // Some registry items uses default export.
  // We want to use named export instead.
  // TODO: do we really need this? - @shadcn.
  // if (file.type !== "registry:page") {
  //   code = code.replaceAll("export default", "export")
  // }

  // Fix imports.
  code = fixImport(code);

  return code;
}

export function getFileTarget(file: {
  path: string;
  type?: string;
  target?: string;
}) {
  if (file.target) {
    return file.target;
  }

  const fileName = file.path.split("/").pop() ?? "";
  const pathParts = file.path.split("/");
  const isAudioPath = pathParts.includes("audio");

  switch (file.type) {
    case "registry:component":
      return `components/audio/${fileName}`;
    case "registry:block":
      return `components/audio/blocks/${fileName}`;
    case "registry:example":
      return `components/audio/examples/${fileName}`;
    case "registry:ui":
      return isAudioPath
        ? `components/audio/${fileName}`
        : `components/ui/${fileName}`;
    case "registry:hook":
      return `hooks/${fileName}`;
    case "registry:lib":
      return `lib/${fileName}`;
    default:
      return "";
  }
}

async function createTempSourceFile(filename: string) {
  const dir = await fs.mkdtemp(path.join(tmpdir(), "shadcn-"));
  return path.join(dir, filename);
}

function fixFilePaths(
  files: Array<{
    path: string;
    type?: string;
    target?: string;
    content?: string;
  }>
) {
  if (!files) {
    return [];
  }

  // Resolve all paths relative to the first file's directory.
  const firstFilePath = files[0]?.path;
  const firstFilePathDir = firstFilePath ? path.dirname(firstFilePath) : "";

  return files.map((file) => ({
    ...file,
    path: path.relative(firstFilePathDir, file.path),
    target: getFileTarget(file),
  }));
}

export function fixImport(content: string) {
  const fixed = content.replace(
    /@\/registry\/[\w-]+\/ui\/audio\/([\w-]+)/g,
    (_, component) => `@/components/audio/${component}`
  );

  const regex =
    /@\/(.+?)\/((?:.*?\/)?(?:components|ui|hooks|lib|examples|particles))\/([\w-]+)/g;

  const replacement = (
    match: string,
    _path: string,
    type: string,
    component: string
  ) => {
    if (type.endsWith("components")) {
      return `@/components/audio/${component}`;
    }
    if (type.endsWith("ui")) {
      return `@/components/ui/${component}`;
    }
    if (type.endsWith("hooks")) {
      return `@/hooks/${component}`;
    }
    if (type.endsWith("lib")) {
      return `@/lib/${component}`;
    }
    if (type.endsWith("examples")) {
      return `@/components/audio/examples/${component}`;
    }
    if (type.endsWith("particles")) {
      return `@/components/audio/blocks/${component}`;
    }

    return match;
  };

  return fixed.replace(regex, replacement);
}

export type FileTree = {
  name: string;
  path?: string;
  children?: FileTree[];
};

function addPathToTree(root: FileTree[], filePath: string) {
  const parts = filePath.split("/");
  let currentLevel = root;

  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    const isLast = i === parts.length - 1;

    if (isLast) {
      const existing = currentLevel.find((node) => node.name === part);
      if (existing) {
        existing.path = filePath;
      } else {
        currentLevel.push({ name: String(part), path: filePath });
      }
      continue;
    }

    let dir = currentLevel.find((node) => node.name === part);
    if (!dir) {
      dir = { name: String(part), children: [] };
      currentLevel.push(dir);
    }

    if (!dir.children) {
      dir.children = [];
    }

    currentLevel = dir.children;
  }
}

export function createFileTreeForRegistryItemFiles(
  files: Array<{ path: string; target?: string }>
) {
  const root: FileTree[] = [];

  for (const file of files) {
    const filePath = file.target ?? file.path;
    addPathToTree(root, filePath);
  }

  return root;
}
