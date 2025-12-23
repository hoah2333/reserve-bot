import { wdModule } from "$lib/WDmodule";
import { siteName } from "$lib/siteInfo";
import { readFileSync } from "fs";
import { JSDOM } from "jsdom";
import { MongoClient } from "mongodb";

import type { AjaxResponse } from "$lib/types";
import type { Collection, WithId } from "mongodb";
import type { PageType } from "./types";

const config: { username: string; password: string; dbLink: string } = JSON.parse(
  readFileSync("./config.json", "utf-8"),
);

const COLOR = {
  RED: "\x1b[31m",
  GREEN: "\x1b[32m",
  YELLOW: "\x1b[33m",
  BLUE: "\x1b[34m",
  MAGENTA: "\x1b[35m",
  CYAN: "\x1b[36m",
  WHITE: "\x1b[37m",
  RESET: "\x1b[0m",
};
const debugInfo = (message: string): void =>
  console.log(`${COLOR.CYAN}${new Date().toLocaleString()} ${COLOR.GREEN}-${COLOR.RESET} ${message}`);

const techSiteName: string = "https://backrooms-tech-cn.wikidot.com";

const techSite = wdModule(techSiteName);

const mongodbLink: string = config.dbLink;

try {
  await techSite.login(config.username, config.password);
} catch (error: unknown) {
  console.error(error);
  console.error("登录失败");
}

debugInfo("程序开始运行");
loopRun();

async function loopRun(): Promise<void> {
  await mainFunc();
  await new Promise((resolve) => setTimeout(resolve, 300000));
  loopRun();
}

async function mainFunc(): Promise<void> {
  const client: MongoClient = new MongoClient(mongodbLink);
  const reservingPages: AjaxResponse = await techSite.getListpages({
    category: "reserve",
    order: "created_at",
    perPage: "250",
    separate: "false",
    module_body:
      "|| %%created_by%% || %%fullname%% || %%form_raw{branch}%% || %%form_raw{page}%% || %%created_at%% || %%title%% ||",
  });
  const outdatedPages: AjaxResponse = await techSite.getListpages({
    category: "outdate",
    order: "created_at desc",
    perPage: "250",
    separate: "false",
    module_body:
      "|| %%created_by%% || %%fullname%% || %%form_raw{branch}%% || %%form_raw{page}%% || %%created_at%% || %%title%% ||",
  });

  debugInfo("开始处理页面");
  const reserve: PageType[] = await listpagesHandler(reservingPages.body);
  await reserveHandler(reserve);
  const outdate: PageType[] = await listpagesHandler(outdatedPages.body);
  await reserveHandler(outdate, true);
  for (const value of reserve) {
    await insertDB(value);
  }

  await client.close();
  debugInfo("程序运行结束");

  async function listpagesHandler(pageBody: string): Promise<PageType[]> {
    const dom: JSDOM = new JSDOM(pageBody);
    const tables: HTMLTableElement[] = Array.from(dom.window.document.querySelectorAll("table.wiki-content-table tr"));
    const pages: PageType[] = [];
    for (const table of tables) {
      const tdArray: HTMLTableCellElement[] = Array.from(table.querySelectorAll("td"));

      const username: string = tdArray[0]?.textContent?.trim() ?? "";
      const reservePage: string = tdArray[1]?.textContent?.trim() ?? "";
      const branchIndex: string = tdArray[2]?.textContent?.trim() ?? "15";
      const pageUnixName: string = reservePage.replace(/^(reserve:)/, "");

      const hasOriginalData: boolean =
        !!branchIndex && (await techSite.isPageExists(siteName[branchIndex], pageUnixName));
      const rawOriginalLink: string = tdArray[3]?.textContent?.trim() ?? "";
      const originalLink: string =
        hasOriginalData && siteName[branchIndex] ?
          `https://${siteName[branchIndex]}.wikidot.com/${pageUnixName}`
        : rawOriginalLink;

      const timestamp: string | undefined = tdArray[4]
        ?.querySelector("span.odate")
        ?.getAttribute("class")
        ?.match(/time_(\d+)/)?.[1];
      const date: Date = new Date(Number(timestamp ?? "0") * 1000);

      const title: string = tdArray[5]?.textContent?.trim() ?? "";

      pages.push({ username, reservePage, branchIndex, originalLink, date, title });
    }
    return pages;
  }

  async function insertDB(insertData: PageType): Promise<void> {
    const reservedCollection: Collection<PageType> = client.db("backrooms-reserve").collection("reserved");

    const dataInDB: WithId<PageType> | null = await reservedCollection.findOne({ date: insertData.date });

    if (dataInDB == null) {
      await reservedCollection.insertOne(insertData);
    } else {
      for (const key in insertData) {
        if (insertData[key as keyof PageType].toLocaleString() !== dataInDB[key as keyof PageType].toLocaleString()) {
          await reservedCollection.updateOne({ _id: dataInDB._id }, { $set: insertData });
          break;
        }
      }
    }
  }

  /**
   * 处理所捕获的翻译预定页面。包括：
   * 1. 检查页面是否已翻译或无原文
   * 2. 当页面建立超过 30 日时自动将页面分类改为 outdate:
   * @param reserve - 翻译预定页面
   * @param isOutdate - 是否为过期页面
   */
  async function reserveHandler(reserves: PageType[], isOutdate = false): Promise<void> {
    for (const reservePage of reserves) {
      const timeAgo: number = new Date().getTime() - reservePage.date.getTime();
      const pageUnixName: string = reservePage.reservePage.replace(/^(reserve:)|(outdate:)/, "");
      await tagEdit(siteName[reservePage.branchIndex], "无原文", true);
      await tagEdit(siteName["99"], "已翻译", false);

      if (!isOutdate && timeAgo > 1000 * 60 * 60 * 24 * 30) {
        debugInfo(`${reservePage.reservePage} 页面已过期，正在重命名`);
        if (await techSite.isPageExistsByListpages(pageUnixName, "outdate")) {
          debugInfo(`${reservePage.reservePage} 检测到重复过期预定，正在删除较旧过期预定`);
          await techSite.deletePage(`outdate:${pageUnixName}`);
        }
        await techSite.renamePage(reservePage.reservePage, `outdate:${pageUnixName}`);
      }

      /**
       * 根据所提供 siteId 寻找目标站点中是否存在 pageUnixName 对应的页面。根据 isNeedFind 进行以下操作：
       * 1. 检查 pageTags 是否包含 tagName 标签，如果包含，则去除该标签。
       * 2. 检查 pageTags 是否不包含 tagName 标签，如果不包含，则添加该标签。
       * @param siteId 站点 ID
       * @param tagName 需要添加或去除的标签
       * @param isNeedFind 是否需要在找到页面后添加标签，若为 false 则在找到页面后去除标签
       **/
      async function tagEdit(siteName: string, tagName: string, isNeedFind: boolean): Promise<void> {
        const pageTags: string[] = await techSite.getTags(reservePage.reservePage);
        const isFindPage: boolean = await techSite.isPageExists(siteName, pageUnixName);
        if (!isFindPage !== isNeedFind && pageTags.includes(tagName)) {
          debugInfo(`${reservePage.reservePage} 标签错误，已去除 ${tagName} 标签`);
          await techSite.editTags(
            pageTags.filter((tag: string): boolean => tag !== tagName),
            reservePage.reservePage,
          );
        } else if (!isFindPage === isNeedFind && !pageTags.includes(tagName)) {
          debugInfo(`${reservePage.reservePage} 标签错误，已添加 ${tagName} 标签`);
          await techSite.editTags([...pageTags, tagName], reservePage.reservePage);
        }
      }
    }
  }
}
