import { describe, expect, test } from "bun:test";
import { registryEvent } from "@/lib/agents/registry-event";

const client = (headers: Record<string, string>) =>
  registryEvent(new Headers(headers), "base-nova", "knob")?.properties.client;

describe("registryEvent", () => {
  test("names the shadcn CLI by the headers it sends", () => {
    expect(
      client({
        accept: "application/vnd.shadcn.v1+json, application/json;q=0.9",
        "sec-fetch-mode": "cors",
        "user-agent": "shadcn",
      })
    ).toBe("shadcn");
  });

  test("a crawler is not an install, whatever its user agent claims", () => {
    expect(client({ "user-agent": "BlockDex/1.0" })).toBe("other");
    expect(client({ "user-agent": "shadcn-marketplace registry sync" })).toBe(
      "other"
    );
    expect(
      client({
        "user-agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      })
    ).toBe("other");
    expect(client({})).toBe("other");
  });

  test("a person opening the file in a browser is a browser", () => {
    expect(client({ "sec-fetch-site": "none" })).toBe("browser");
    expect(client({ "sec-fetch-site": "cross-site" })).toBe("browser");
  });

  test("the site reading its own registry to show the code counts for nothing", () => {
    expect(
      registryEvent(
        new Headers({ "sec-fetch-site": "same-origin" }),
        "base-nova",
        "knob"
      )
    ).toBeUndefined();
  });

  test("the index is not an item", () => {
    expect(
      registryEvent(new Headers(), "base-nova", "registry")
    ).toBeUndefined();
  });

  test("says which item, in which style", () => {
    expect(
      registryEvent(new Headers({ "user-agent": "shadcn" }), "base-lyra", "pad")
    ).toEqual({
      name: "registry_access",
      properties: { client: "shadcn", component: "pad", style: "base-lyra" },
    });
  });
});
