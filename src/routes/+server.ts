import WDmodule from "$lib/WDmodule";
import siteInfo from "$lib/siteInfo";
import type { AxiosResponse } from "axios";
import * as cheerio from "cheerio";
import * as fs from "fs";
import { MongoClient } from "mongodb";
import type { Db, Collection, WithId } from "mongodb";

interface PageType {
  username: string;
  reservePage: string;
  branchId: string;
  originalLink: string;
  date: Date;
  title: string;
}

const config: {
  username: string;
  password: string;
  dbLink: string;
} = JSON.parse(fs.readFileSync("./config.json", "utf-8"));

const techSiteName: string = "https://backrooms-tech-cn.wikidot.com";
const techSiteId: number = 5041861;
const wikiSiteId: number = 4716348;

const techSite: WDmodule = new WDmodule(techSiteName);

const MongodbLink: string = config.dbLink;

try {
  await techSite.login(config.username, config.password);
} catch (error: any) {
  console.error(error);
}

console.log(`${new Date().toLocaleString()} - 程序开始运行`);
await mainFunc();
setInterval(mainFunc, 30000);

async function mainFunc(): Promise<void> {
  const client: MongoClient = new MongoClient(MongodbLink);
  let reservingPages: AxiosResponse<any, any> = await techSite.getListpages({
    category: "reserve",
    order: "created_at desc",
    perPage: "250",
    separate: "false",
    module_body:
      "|| %%created_by%% || %%fullname%% || %%form_raw{branch}%% || %%form_raw{page}%% || %%created_at%% || %%title%% ||",
  });
  let outdatedPages: AxiosResponse<any, any> = await techSite.getListpages({
    category: "outdate",
    order: "created_at desc",
    perPage: "250",
    separate: "false",
    module_body:
      "|| %%created_by%% || %%fullname%% || %%form_raw{branch}%% || %%form_raw{page}%% || %%created_at%% || %%title%% ||",
  });

  console.log(`${new Date().toLocaleString()} - 开始处理页面`);
  let reserve: PageType[] = await listpagesHandler(cheerio.load(reservingPages.data.body));
  let outdate: PageType[] = await listpagesHandler(cheerio.load(outdatedPages.data.body));
  await reserveHandler(reserve);
  await reserveHandler(outdate, true);
  for (const value of reserve) {
    await insertDB(value);
  }

  await client.close();

  async function listpagesHandler($: cheerio.CheerioAPI): Promise<PageType[]> {
    return await Promise.all(
      $("table.wiki-content-table tr")
        .map(async function (this: cheerio.Element): Promise<PageType> {
          let page: PageType = {
            username: "",
            reservePage: "",
            branchId: "",
            originalLink: "",
            date: new Date(),
            title: "",
          };
          let thisData: string[] = $(this)
            .find("td")
            .map((index: number, element: cheerio.Element): string => {
              if (index != 4) {
                return $(element).text();
              } else {
                return (
                  $(element)
                    .find("span.odate")
                    .attr("class")
                    ?.match(/time_([0-9]+)/)?.[1] || ""
                );
              }
            })
            .toArray();
          let pageUnixName: string = thisData[1].replace(/^(reserve:)/, "");
          let originalData: Record<string, string> | undefined = (
            await techSite.searchPage(siteInfo.siteId[thisData[2]], pageUnixName)
          ).find((result: Record<string, string>): boolean => result.unix_name === pageUnixName);
          for (let index: number = 0; index < thisData.length; index++) {
            switch (index) {
              case 0:
                page.username = thisData[index];
                break;
              case 1:
                page.reservePage = thisData[index];
                break;
              case 2:
                page.branchId = thisData[index];
                break;
              case 3:
                if (originalData) {
                  page.originalLink = `http://${siteInfo.siteName[page.branchId]}.wikidot.com/${pageUnixName}`;
                } else {
                  page.originalLink = thisData[index];
                }
                break;
              case 4:
                page.date = new Date(parseInt(`${thisData[index]}000`));
                break;
              case 5:
                if (originalData) {
                  page.title = originalData.title;
                } else {
                  page.title = thisData[index];
                }
            }
          }
          return page;
        })
        .get(),
    );
  }

  async function insertDB(insertData: PageType): Promise<void> {
    const database: Db = client.db("backrooms-reserve");
    const reserved: Collection<PageType> = database.collection("reserved");

    let dataInDB: WithId<PageType> | null = await reserved.findOne({ date: insertData.date });

    if (dataInDB == null) {
      await reserved.insertOne(insertData);
      console.log(`${new Date().toLocaleString()} - 已插入数据`);
    } else {
      for (const key in insertData) {
        if (insertData[key as keyof PageType].toLocaleString() !== dataInDB[key as keyof PageType].toLocaleString()) {
          await reserved.updateOne({ _id: dataInDB._id }, { $set: insertData });
          console.log(`${new Date().toLocaleString()} - 已更新数据`);
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
   * @param isOutdate -
   */
  async function reserveHandler(reserve: PageType[], isOutdate = false): Promise<void> {
    reserve.forEach(async (page: PageType): Promise<void> => {
      let timeAgo: number = new Date().getTime() - page.date.getTime();
      let pageUnixName: string = page.reservePage.replace(/^(reserve:)|(outdate:)/, "");
      let pageTags: string = await techSite.getTags(page.reservePage);

      await tagEdit(siteInfo.siteId[page.branchId], "无原文", true);
      pageTags = await techSite.getTags(page.reservePage); // reset pageTags cause tagEdit may change it
      await tagEdit(wikiSiteId, "已翻译", false);

      /**
       * 根据所提供 siteId 寻找目标站点中是否存在 pageUnixName 对应的页面。根据 isNeedFind 进行以下操作：
       * 1. 检查 pageTags 是否包含 tagName 标签，如果包含，则去除该标签。
       * 2. 检查 pageTags 是否不包含 tagName 标签，如果不包含，则添加该标签。
       * @param siteId 站点 ID
       * @param tagName 需要添加或去除的标签
       * @param isNeedFind 是否需要在找到页面后添加标签，若为 false 则在找到页面后去除标签
       **/
      async function tagEdit(siteId: number, tagName: string, isNeedFind: boolean): Promise<void> {
        let isFindPage: Record<string, string> | undefined = (await techSite.searchPage(siteId, pageUnixName)).find(
          (result: Record<string, string>): boolean => result.unix_name === pageUnixName,
        );
        if (!isFindPage !== isNeedFind && pageTags.includes(tagName)) {
          console.log(`${new Date().toLocaleString()} - ${page.reservePage} 标签错误，已去除 ${tagName} 标签`);
          await techSite.editTags(pageTags.replace(tagName, ""), page.reservePage);
        } else if (!isFindPage === isNeedFind && !pageTags.includes(tagName)) {
          console.log(`${new Date().toLocaleString()} - ${page.reservePage} 标签错误，已添加 ${tagName} 标签`);
          await techSite.editTags(`${pageTags} ${tagName}`, page.reservePage);
        }
      }

      if (!isOutdate && timeAgo > 1000 * 60 * 60 * 24 * 30) {
        console.log(`${new Date().toLocaleString()} - ${page.reservePage} 页面已过期，正在重命名`);

        if (
          (await techSite.searchPage(techSiteId, `outdate:${pageUnixName}`)).find(
            (result: Record<string, string>) => result.unix_name === `outdate:${pageUnixName}`,
          )
        ) {
          console.log(`${new Date().toLocaleString()} - ${page.reservePage} 检测到重复过期预定，正在删除较旧过期预定`);
          await techSite.deletePage(`outdate:${pageUnixName}`);
        }
        await techSite.renamePage(page.reservePage, `outdate:${pageUnixName}`);
      }
    });
  }
}
