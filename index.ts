import { Database } from "bun:sqlite";
import {ulid} from "ulid";

const hardcodedPassword = process.env.ACCESS_TOKEN || "password";

const server = Bun.serve({
    port: 8083,
    async fetch(req) {
        const url = new URL(req.url);
        if (url.pathname === "/rest/webhook" && req.method === "POST") {
            if (req.headers.get("Authorization") !== `Bearer ${hardcodedPassword}`) {
                return new Response("Unauthorized!", { status: 401 });
            }
            const body = await req.text();
            console.log(`Received request`);
            let data;
            const optionalTags = url.searchParams.get("tags"); // comma separated tags like "tag1,tag2"
            try {
                data = JSON.parse(body);
            } catch (e) {
                const regex = /"url"\s*:\s*"([^"]+)"\s*,\s*"data"\s*:\s*"([\s\S]+)"/m;
                const match = body.match(regex);
                if (match) {
                        data = {
                        url: match[1],
                        data: match[2]
                        };
                    } else {
                        console.error("Could not parse body");
                        return new Response("Could not parse body", { status: 400 });
                    }
            }
            console.log(`URL: ${data.url}`);
            console.log(`Data: ${trucateLogger(data.data)}`);
            saveToSQLite(data.url, data.data, optionalTags ? optionalTags.split(",") : []);
            return new Response("Received!");
        }
        if (url.pathname === "/db" && req.method === "GET") {
            const pageNumber = parseInt(url.searchParams.get("pageNumber") || "0", 10);
            const pageCount = parseInt(url.searchParams.get("pageCount") || "10", 10);
            console.log(`pageNumber: ${pageNumber}`);
            console.log(`pageCount: ${pageCount}`);
            const rows = getRowsFromSQLite(pageNumber, pageCount);
            return new Response(JSON.stringify(rows), {
                headers: {
                    "Content-Type": "application/json",
                },
            });
        }
        if (url.pathname === "/db/mark" && req.method === "POST") {
            const id = url.searchParams.get("id");
            if (req.headers.get("Authorization") !== `Bearer ${hardcodedPassword}`) {
                return new Response("Unauthorized!", { status: 401 });
            }
            console.log(`Marking as read: ${id}`);
            if (!id) {
                return new Response("Please provide an id!", { status: 400 });
            }
            markReadInSQLite(id);
            return new Response("Marked as read!");
        }
        if (url.pathname === "/db/clean" && req.method === "DELETE") {
            console.log(`Removing read rows`);
            if (req.headers.get("Authorization") !== `Bearer ${hardcodedPassword}`) {
                return new Response("Unauthorized!", { status: 401 });
            }
            removeMarkedReadFromSQLite();
            return new Response("Removed read rows!");
        }
        if (url.pathname === "/db/stats" && req.method === "GET") {
            console.log(`Getting stats`);
            if (req.headers.get("Authorization") !== `Bearer ${hardcodedPassword}`) {
                return new Response("Unauthorized!", { status: 401 });
            }
            const stats = getDBStats();
            return new Response(JSON.stringify(stats), {
                headers: {
                    "Content-Type": "application/json",
                },
            });
        }
        if (url.pathname === "/danger/db/clean" && req.method === "DELETE") {
            console.log(`Removing all rows`);
            if (req.headers.get("Authorization") !== `Bearer ${hardcodedPassword}`) {
                return new Response("Unauthorized!", { status: 401 });
            }
            removeALLFromSQLite();
            return new Response("Removed all rows!");
        }
        return new Response("404!");
      },
});


function saveToSQLite(url: string, data: string, tags: string[] = []) {
    const db = new Database("mydb.sqlite", { create: true });
    const formatedUrl = new URL(url).origin + new URL(url).pathname;
    const createTableQuery = db.query(`
        CREATE TABLE IF NOT EXISTS content (
        id TEXT PRIMARY KEY,
        url TEXT UNIQUE,
        data BLOB,
        date TEXT,
        read INTEGER,
        tags TEXT
        );
    `);
    createTableQuery.run();

    // Convert tags array to string
    const tagsString = tags.join(',');

    // Check if URL exists
    const urlExistsQuery = db.query(`SELECT url FROM content WHERE url = ?`);
    const urlExists = urlExistsQuery.get(formatedUrl);

    if (urlExists) {
        // If URL exists, update the row
        const updateDataQuery = db.query(`
            UPDATE content
            SET data = ?, date = ?, read = ?, tags = ?
            WHERE url = ?
        `);
        updateDataQuery.run(data, new Date().toISOString(), 0, tagsString, formatedUrl);
    } else {
        // If URL does not exist, insert a new row
        const insertDataQuery = db.query(`
            INSERT INTO content (id, url, data, date, read, tags)
            VALUES (?, ?, ?, ?, ?, ?)
        `);
        insertDataQuery.run(ulid(), formatedUrl, data, new Date().toISOString(), 0, tagsString);
    }

    // print count of rows
    const countQuery = db.query(`SELECT COUNT(*) as count FROM content`);
    console.log(`Rows in the table: ${JSON.stringify(countQuery.get())}`);
}

function getRowsFromSQLite(pageNumber: number, pageCount: number) {
    const db = new Database("mydb.sqlite", { create: true });
    const selectQuery = db.query(`
        SELECT * FROM content
        ORDER BY date DESC
        LIMIT ${pageCount} OFFSET ${pageNumber * pageCount}
    `);
    const rows = selectQuery.all();
    return rows;
}

function markReadInSQLite(id: string) {
    const db = new Database("mydb.sqlite", { create: true });
    const markReadQuery = db.query(`
        UPDATE content
        SET read = 1
        WHERE id = ?
    `);
    markReadQuery.run(id);
}

function getDBStats() {
    const db = new Database("mydb.sqlite", { create: true });
    const countQuery = db.query(`SELECT COUNT(*) as count FROM content`);
    const readCountQuery = db.query(`SELECT COUNT(*) as count FROM content WHERE read = 1`);
    const unreadCountQuery = db.query(`SELECT COUNT(*) as count FROM content WHERE read = 0`);
    const sizeQuery = db.query(`SELECT page_count * page_size as size FROM pragma_page_count(), pragma_page_size()`);
    const rows = countQuery.get();
    const readRows = readCountQuery.get();
    const unreadRows = unreadCountQuery.get();
    const size = sizeQuery.get() as {size: string};
    const sizeInMB = `${parseFloat(size.size) / 1024 / 1024} MB`;
    return {rows, readRows, unreadRows, sizeInMB};
}

function removeALLFromSQLite() {
    const db = new Database("mydb.sqlite", { create: true });
    const removeQuery = db.query(`
        DELETE FROM content
    `);
    removeQuery.run();
}

function removeMarkedReadFromSQLite() {
    const db = new Database("mydb.sqlite", { create: true });
    const removeQuery = db.query(`
        DELETE FROM content
        WHERE read = 1
    `);
    removeQuery.run();
}

function trucateLogger(data: string){
    return data.length > 50 ? `${data.substring(0, 50)}...` : data;
}
  
console.log(`Listening on http://localhost:${server.port} ...`);