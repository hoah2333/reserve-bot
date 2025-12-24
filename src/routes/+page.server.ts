import { env } from "$env/dynamic/private";
import { MongoClient } from "mongodb";

import type { Collection, WithId } from "mongodb";
import type { PageServerLoad } from "./$types";
import type { PageType } from "./types";

const config: { dbLink: string } = { dbLink: env.DB_LINK };

const createDbCache = () => {
  let cache: WithId<PageType>[] = [];
  const getCache = (): WithId<PageType>[] => cache;
  const updateCache = async (): Promise<void> => {
    const client: MongoClient = new MongoClient(config.dbLink);
    const reserved: Collection<PageType> = client.db("backrooms-reserve").collection("reserved");
    const freshData: WithId<PageType>[] = await reserved.find().toArray();
    cache = JSON.parse(JSON.stringify(freshData)); // Deep Copy
    await client.close();
  };

  return { getCache, updateCache };
};

const { getCache, updateCache } = createDbCache();

await updateCache();
setInterval(updateCache, 30000);

export const load: PageServerLoad = async (): Promise<Record<string, WithId<PageType>[]>> => ({
  dbContent: getCache(),
});
