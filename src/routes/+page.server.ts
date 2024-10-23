import type { PageServerLoad } from "./$types";
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
    dbLink: string;
} = JSON.parse(fs.readFileSync("./config.json", "utf-8"));

let dbContent: WithId<PageType>[];

const MongodbLink: string = config.dbLink;

async function getDbContent(): Promise<void> {
    const client: MongoClient = new MongoClient(MongodbLink);
    const database: Db = client.db("backrooms-reserve");
    const reserved: Collection<PageType> = database.collection("reserved");
    dbContent = JSON.parse(JSON.stringify(await reserved.find().toArray())); // Deep Copy
    await client.close();
}

await getDbContent();

setInterval(getDbContent, 30000);

export const load: PageServerLoad = async (): Promise<Record<string, WithId<PageType>[]>> => {
    return { dbContent };
};
