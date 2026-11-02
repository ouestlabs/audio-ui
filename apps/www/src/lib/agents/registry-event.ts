/** Who asked for a registry file: the shadcn CLI names itself, and only a browser says where a fetch comes from. */
function registryClient(headers: Headers) {
  if (headers.get("user-agent") === "shadcn") {
    return "shadcn";
  }
  return headers.has("sec-fetch-site") ? "browser" : "other";
}

/**
 * What PostHog is told about a registry file that was served. It counts fetches,
 * not installs: `shadcn add` fetches the item twice and each dependency once, and
 * a crawler fetches them all. The index is not an item, and the site reading its
 * own registry to show a component's code is nobody using it.
 */
export function registryEvent(headers: Headers, style: string, name: string) {
  if (name === "registry" || headers.get("sec-fetch-site") === "same-origin") {
    return;
  }
  return {
    name: "registry_access",
    properties: { client: registryClient(headers), component: name, style },
  };
}
