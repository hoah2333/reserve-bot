import WDmethod from "./WDmethod";
import * as cheerio from "cheerio";
import { type AxiosResponse } from "axios";

class WDmodule {
    public base: string;
    public wdMethod: WDmethod;
    constructor(base: string) {
        this.base = base;
        this.wdMethod = new WDmethod(base);
    }

    /**
     * 
     * @param username 用户名
     * @param password 密码
     * @returns 
     */
    async login(username: string, password: string): Promise<WDmethod> {
        return await this.wdMethod.login(username, password);
    }

    /**
     * 利用 Wikidot 的 ListPages 模块获取页面列表
     * @param params ListPages 参数
     * - 详见 https://www.wikidot.com/doc-modules:listpages-module
     * @returns ListPages 返回值
     */
    async getListpages(params: Record<string, string | number>): Promise<AxiosResponse> {
        return await this.wdMethod.ajaxPost(params, "list/ListPagesModule");
    }

    /**
     * 获取页面 HTML 源代码
     * @param page 页面名称
     * @returns 页面渲染完毕后的 HTML 源代码
     */
    async getPageSource(page: string): Promise<cheerio.CheerioAPI> {
        return await this.wdMethod.getPageSource(page, false);
    }

    /**
     * 获取标签列表
     * @param page 页面名称
     * @returns 页面标签列表，以空格分隔
     */
    async getTags(page: string): Promise<string> {
        return cheerio.load((await this.wdMethod.ajaxPost(
            {
                pageId: await this.wdMethod.getPageId(page)
            },
            "pagetags/PageTagsModule"
        )).data.body)("input#page-tags-input").attr("value") || "";
    }

    /**
     * 编辑标签
     * @param tags 标签列表，以空格分隔
     * @param page 页面名称
     * @returns 
     */
    async editTags(tags: string, page: string): Promise<AxiosResponse> {
        return await this.wdMethod.pageActionPost(
            {
                tags: tags,
                pageId: await this.wdMethod.getPageId(page)
            },
            "saveTags"
        );
    }

    /**
     * 重命名页面
     * @param page 页面名称
     * @param newPage 新页面名称
     * @returns 
     */
    async renamePage(page: string, newPage: string): Promise<AxiosResponse> {
        return await this.wdMethod.pageActionPost(
            {
                new_name: newPage,
                page_id: await this.wdMethod.getPageId(page)
            },
            "renamePage"
        );
    }

    /**
     * 删除页面
     * @param page 页面名称
     * @returns 
     */
    async deletePage(page: string): Promise<AxiosResponse> {
        return await this.wdMethod.pageActionPost(
            {
                page_id: await this.wdMethod.getPageId(page)
            },
            "deletePage"
        );
    }

    /**
     * 搜索页面
     * @param siteId 站点 ID
     * @param query 搜索字符串
     * @returns 
     */
    async searchPage(siteId: number, query: string): Promise<Record<string, string>[]> {
        return (await this.wdMethod.quickGet(
            {
                s: siteId,
                q: query
            },
            "PageLookupQModule"
        )).data.pages;
    }
}

export default WDmodule;
