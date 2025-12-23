<script lang="ts">
  import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "$lib/components/ui/table";
  import {
    Pagination,
    PaginationContent,
    PaginationItem,
    PaginationPrevButton,
    PaginationNextButton,
    PaginationEllipsis,
    PaginationLink,
  } from "$lib/components/ui/pagination";

  import type { PageItem } from "bits-ui";
  import Button from "$lib/components/ui/button/button.svelte";

  let { data } = $props();
  let dbContent = $derived(data.dbContent);

  let currentPage = $state<number>(1);
  let pageSize = $state<number>(10);
  let pageContent = $derived(dbContent.slice((currentPage - 1) * pageSize, currentPage * pageSize));
</script>

<header class="my-4 text-center">
  <span class="text-2xl font-bold">翻译预定归档列表</span>
</header>

<main class="mx-10 flex flex-col justify-center gap-4">
  <Table class="border-collapse">
    <TableHeader class="bg-emerald-700">
      <TableRow>
        <TableHead>序号</TableHead>
        <TableHead>预定用户</TableHead>
        <TableHead>预定时间</TableHead>
        <TableHead>原文链接</TableHead>
        <TableHead>预定标题</TableHead>
      </TableRow>
    </TableHeader>
    <TableBody class="bg-emerald-900">
      {#each pageContent as dbData, index}
        <TableRow>
          <TableCell>{(currentPage - 1) * pageSize + index + 1}</TableCell>
          <TableCell>
            {#if dbData.username !== "(user deleted)"}
              <Button
                variant="link"
                class="h-min p-0"
                href="https://www.wikidot.com/user:info/{dbData.username
                  .replace(/[.'!&\-_\\/\(\)\+ ]+/g, '-')
                  .toLowerCase()}"
                target="_blank"
                rel="noopener noreferrer"
              >
                {dbData.username}
              </Button>
            {:else}
              <span>{dbData.username}</span>
            {/if}
          </TableCell>
          <TableCell>{new Date(dbData.date).toLocaleString()}</TableCell>
          <TableCell>
            <Button
              variant="link"
              class="h-min p-0"
              href={dbData.originalLink}
              target="_blank"
              rel="noopener noreferrer"
            >
              {dbData.originalLink}
            </Button>
          </TableCell>
          <TableCell>
            <Button
              variant="link"
              class="h-min p-0"
              href="https://backrooms-tech-cn.wikidot.com/{dbData.reservePage}"
              target="_blank"
              rel="noopener noreferrer"
            >
              {dbData.title}
            </Button>
          </TableCell>
        </TableRow>
      {/each}
    </TableBody>
  </Table>

  <Pagination count={dbContent.length} perPage={pageSize} bind:page={currentPage}>
    {#snippet children({ pages, currentPage }: { pages: PageItem[]; currentPage: number })}
      <PaginationContent>
        <PaginationItem>
          <PaginationPrevButton />
        </PaginationItem>
        {#each pages as page (page.key)}
          {#if page.type === "ellipsis"}
            <PaginationItem>
              <PaginationEllipsis />
            </PaginationItem>
          {:else}
            <PaginationItem>
              <PaginationLink {page} isActive={currentPage === page.value}>
                {page.value}
              </PaginationLink>
            </PaginationItem>
          {/if}
        {/each}
        <PaginationItem>
          <PaginationNextButton />
        </PaginationItem>
      </PaginationContent>
    {/snippet}
  </Pagination>
</main>
