<script lang="ts">
import { type Snippet, setContext } from "svelte";
import { DEFAULTS, type Defaults } from "./parts.ts";

let { children, dragMode }: Defaults & { children: Snippet } = $props();
// Read as the knobs render, so a change of the prop reaches them.
setContext<Defaults>(DEFAULTS, {
  get dragMode() {
    return dragMode;
  },
});
</script>

{@render children()}
