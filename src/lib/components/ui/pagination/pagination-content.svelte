<script lang="ts">
  import { cn } from "$lib/utils.js";

  import type { HTMLAttributes } from "svelte/elements";
  import type { WithElementRef } from "$lib/utils.js";

  let {
    ref = $bindable(null),
    class: className,
    children,
    ...restProps
  }: WithElementRef<HTMLAttributes<HTMLUListElement>> = $props();
</script>

<ul
  bind:this={ref}
  data-slot="pagination-content"
  class={cn("flex flex-row items-center gap-1", className)}
  {...restProps}
>
  {@render children?.()}
</ul>
