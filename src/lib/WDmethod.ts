import { JSDOM } from "jsdom";
import { stringify as qsStringify } from "qs";

import type { AjaxResponse, QuickModuleResponse } from "./types";

export const wdMethod = (baseUrl: string) => {
  let cookie: string = "";
  const ajaxPath: string = `${baseUrl}/ajax-module-connector.php`;
  const quickPath: string = `${baseUrl}/quickmodule.php`;

  const generateToken = (): string => Math.random().toString(16).substring(4).toLowerCase();
  const errorInfo = (message: string, error: unknown): void =>
    console.error(`${new Date().toLocaleString()} - ${message}：${error}`);

  const headers = (token: string = generateToken()): Record<string, string> => ({
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36",
    "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
    "Cookie": `${cookie} wikidot_token7=${token};`,
    "Origin": baseUrl,
    "Referer": "BRBot.aic",
  });

  const isNonRetryableError = (error: unknown): boolean => Boolean((error as { noRetry?: boolean })?.noRetry === true);

  const retry = async <T>(fn: () => Promise<T>, retryCount: number = 0): Promise<T> => {
    try {
      return await fn();
    } catch (error) {
      if (isNonRetryableError(error) || retryCount >= 60) throw error;
      await new Promise((resolve) => setTimeout(resolve, 1000 * (retryCount + 1)));
      return await retry<T>(fn, retryCount + 1);
    }
  };

  const login = async (username: string, password: string): Promise<void> => {
    return await retry(async () => {
      try {
        const token7 = generateToken();
        const response = await fetch("https://www.wikidot.com/default--flow/login__LoginPopupScreen", {
          method: "POST",
          redirect: "follow",
          headers: headers(token7),
          body: qsStringify({
            callbackIndex: 0,
            wikidot_token7: token7,
            login: username,
            password: password,
            action: "Login2Action",
            event: "login",
          }),
        });
        if (!response.ok) {
          throw new Error(response.statusText);
        }
        const loginDom: JSDOM = new JSDOM(await response.text());
        const errorMessage: HTMLElement | null = loginDom.window.document.querySelector("h2.error");
        if (errorMessage?.textContent.includes("The login and password do not match.")) {
          const authError = new Error("用户名或密码错误");
          (authError as { noRetry?: boolean }).noRetry = true;
          throw authError;
        }
        const setCookie: string | null = response.headers.get("Set-Cookie");
        if (setCookie) {
          const sessionId = setCookie.match(/WIKIDOT_SESSION_ID=([^;]+)/)?.[1];
          cookie = `WIKIDOT_SESSION_ID=${sessionId}; wikidot_udsession=1;`;
        }
      } catch (error) {
        errorInfo("登录失败", error);
        throw error;
      }
    });
  };

  const ajaxPost = async (params: Record<string, string | number>, moduleName: string): Promise<AjaxResponse> => {
    return await retry(async () => {
      try {
        const token7 = generateToken();
        const response = await fetch(ajaxPath, {
          method: "POST",
          headers: headers(token7),
          body: qsStringify(Object.assign({ moduleName, callbackIndex: 0, wikidot_token7: token7 }, params)),
        });
        if (!response.ok) {
          throw new Error(response.statusText);
        }
        return await response.json();
      } catch (error) {
        errorInfo("AJAX POST 失败", error);
        throw error;
      }
    });
  };

  /**
   * @deprecated quickGet 大概率报错 Internal Server Error，使用 Crom API 查询页面是否存在
   */
  const quickGet = async (params: Record<string, string | number>, module: string): Promise<QuickModuleResponse> => {
    return await retry<QuickModuleResponse>(async () => {
      try {
        const response = await fetch(quickPath + "?" + qsStringify(Object.assign({ module }, params)), {
          method: "GET",
          headers: headers(),
        });

        if (!response.ok) {
          throw new Error(response.statusText);
        }
        return await response.json();
      } catch (error) {
        errorInfo("QuickModule GET 失败", error);
        throw error;
      }
    });
  };

  const cromApiRequest = async (
    gqlQueryString: string,
    variables: Record<string, string>,
  ): Promise<Record<string, unknown>> => {
    return await retry(async () => {
      try {
        const response = await fetch("https://apiv1.crom.avn.sh/graphql", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query: gqlQueryString, variables }),
        });
        if (!response.ok) {
          throw new Error(response.statusText);
        }
        const { data, errors } = await response.json();
        if (errors) {
          throw new Error(errors[0].message);
        }

        return data;
      } catch (error) {
        errorInfo("Crom API 请求失败", error);
        throw error;
      }
    });
  };

  const getPageSource = async (page: string, norender: boolean = true): Promise<string> => {
    return await retry(async () => {
      try {
        const response = await fetch(
          `${page.startsWith("http") ? page : `${baseUrl}/${page}`}${norender ? "/norender/true" : ""}`,
          { method: "GET", headers: headers() },
        );
        if (!response.ok) {
          throw new Error(response.statusText);
        }
        return await response.text();
      } catch (error) {
        errorInfo("获取页面源代码失败", error);
        throw error;
      }
    });
  };

  const getPageId = async (page: string): Promise<number> => {
    const pageSource: string = await getPageSource(page);
    const dom: JSDOM = new JSDOM(pageSource);
    const scriptTag: Element = Array.from(dom.window.document.querySelectorAll("head > script")).filter(
      (element: Element): boolean => {
        const scriptText: string = element.textContent || "";
        return scriptText.includes("WIKIREQUEST");
      },
    )[0];
    const pageIdMatch: RegExpMatchArray | null = scriptTag.textContent?.match(
      /WIKIREQUEST\.info\.pageId\s*=\s*(\d+)\s*;/g,
    );
    if (pageIdMatch) {
      return parseInt(pageIdMatch[0].slice(26, -1));
    }
    return 0;
  };

  return { login, ajaxPost, quickGet, cromApiRequest, getPageSource, getPageId };
};
