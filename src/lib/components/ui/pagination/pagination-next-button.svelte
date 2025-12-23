<script lang="ts">
  import ChevronRightIcon from "@lucide/svelte/icons/chevron-right";

  import { Pagination as PaginationPrimitive } from "bits-ui";
  import { buttonVariants } from "$lib/components/ui/button/index.js";
  import { cn } from "$lib/utils.js";

  let {
    ref = $bindable(null),
    class: className,
    children,
    ...restProps
  }: PaginationPrimitive.NextButtonProps = $props();
</script>

{#snippet Fallback()}
  <span>下一页</span>
  <ChevronRightIcon class="size-4" />
{/snippet}

<PaginationPrimitive.NextButton
  bind:ref
  aria-label="前往下一页"
  class={cn(buttonVariants({ size: "default", variant: "ghost", class: "gap-1 px-2.5 sm:pe-2.5" }), className)}
  children={children || Fallback}
  {...restProps}
/>
