<script lang="ts">
import { getContext } from "svelte";
import { DEFAULTS, type Defaults, parts } from "./parts";

let props = $props();
const defaults = getContext<Defaults | undefined>(DEFAULTS) ?? {};
</script>

<parts.Root {...defaults} {...props} />
