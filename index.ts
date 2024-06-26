import { Database } from "bun:sqlite";
import {ulid} from "ulid";

const hardcodedPassword = process.env.ACCESS_TOKEN || "password";

const server = Bun.serve({
    port: 8083,
    async fetch(req) {
        const url = new URL(req.url);
        const corsHeaders = {
            "Access-Control-Allow-Origin": "*",
        };
        if (url.pathname === "/rest/webhook" && req.method === "POST") {
            if (req.headers.get("Authorization") !== `Bearer ${hardcodedPassword}`) {
                return new Response("Unauthorized!", { status: 401 , headers: corsHeaders});
            }
            const body = await req.text();
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
            return new Response("Received!", { headers: corsHeaders });
        }
        if (url.pathname === "/db" && req.method === "GET") {
            const pageNumber = parseInt(url.searchParams.get("pageNumber") || "0", 10);
            const pageCount = parseInt(url.searchParams.get("pageCount") || "50", 10);
            const rows = getRowsFromSQLite(pageNumber, pageCount);
            return new Response(JSON.stringify(rows), {
                headers: {
                    ...corsHeaders,
                    "Content-Type": "application/json",
                },
            });
        }
        if (url.pathname === "/db/mark" && req.method === "GET") {
            const id = url.searchParams.get("id");
            // if (req.headers.get("Authorization") !== `Bearer ${hardcodedPassword}`) {
            //     return new Response("Unauthorized!", {
            //         status: 401,
            //         headers: {
            //             ...corsHeaders,
            //             "Content-Type": "application/json",
            //         },
            //     });
            // }
            console.log(`Marking as read: ${id}`);
            if (!id) {
                return new Response("Please provide an id!", {
                    status: 400,
                    headers: {
                        ...corsHeaders,
                        "Content-Type": "application/json",
                    },
                });
            }
            markReadInSQLite(id);
            return new Response("Marked as read!", {
                status: 200,
                headers: {
                    ...corsHeaders,
                    "Content-Type": "application/json",
                },
            });
        }
        if (url.pathname === "/db/mark/unread" && req.method === "GET") {
            const id = url.searchParams.get("id");
            // if (req.headers.get("Authorization") !== `Bearer ${hardcodedPassword}`) {
            //     return new Response("Unauthorized!", {
            //         status: 401,
            //         headers: {
            //             ...corsHeaders,
            //             "Content-Type": "application/json",
            //         },
            //     });
            // }
            console.log(`Marking as unread: ${id}`);
            if (!id) {
                return new Response("Please provide an id!", {
                    status: 401,
                    headers: {
                        ...corsHeaders,
                        "Content-Type": "application/json",
                    },
                });
            }
            markUnReadInSQLite(id);
            return new Response("Marked as unread!", {
                status: 200,
                headers: {
                    ...corsHeaders,
                    "Content-Type": "application/json",
                },
            });
        }
        if (url.pathname === "/db/clean" && req.method === "DELETE") {
            console.log(`Removing read rows`);
            if (req.headers.get("Authorization") !== `Bearer ${hardcodedPassword}`) {
                return new Response("Unauthorized!", {
                    status: 401,
                    headers: {
                        ...corsHeaders,
                        "Content-Type": "application/json",
                    },
                });
            }
            removeMarkedReadFromSQLite();
            return new Response("Removed read rows!");
        }
        if (url.pathname === "/db/stats" && req.method === "GET") {
            console.log(`Getting stats`);
            const stats = getDBStats();
            return new Response(JSON.stringify(stats), {
                headers: {
                    ...corsHeaders,
                    "Content-Type": "application/json",
                },
            });
        }
        if (url.pathname === "/db/tag" && req.method === "POST") {
            const tags = url.searchParams.get("tags") || "";
            const id = url.searchParams.get("id");
            if (!id) {
                return new Response("Please provide an id!", {
                    status: 400,
                    headers: {
                        ...corsHeaders,
                        "Content-Type": "application/json",
                    },
                });
            }
            console.log(`Updating tags for ${id} with ${tags}`);
            updateTagList(tags.split(','), id);
        }
        if (url.pathname === "/danger/db/clean" && req.method === "DELETE") {
            console.log(`Removing all rows`);
            if (req.headers.get("Authorization") !== `Bearer ${hardcodedPassword}`) {
                return new Response("Unauthorized!", {
                    status: 401,
                    headers: {
                        ...corsHeaders,
                        "Content-Type": "application/json",
                    },
                });
            }
            removeALLFromSQLite();
            return new Response("Removed all rows!");
        }


        // ---- tags 
        if (url.pathname === "/tag" && req.method === "GET") {
            const tags = getTagsFromTable();
            return new Response(JSON.stringify(tags), {
                headers: {
                    ...corsHeaders,
                    "Content-Type": "application/json",
                },
            });
        }

        if (url.pathname === "/tag" && req.method === "POST") {
            const tag = url.searchParams.get("tag") || "";
            const additionalJsonDetails = url.searchParams.get("additionalJsonDetails") || "";
            const groupTags = url.searchParams.get("groupTags") || "";
            const label = url.searchParams.get("label");
            const color = url.searchParams.get("color");

            if (!label || !color) {
                return new Response("Please provide label and color!", {
                    status: 400,
                    headers: {
                        ...corsHeaders,
                        "Content-Type": "application/json",
                    },
                });
            }
            console.log(`Adding tag: ${tag}`);
            addToTagsTable(tag, label!, color!, additionalJsonDetails, groupTags.split(','));
            return new Response("Added tag!", {
                status: 200,
                headers: {
                    ...corsHeaders,
                    "Content-Type": "application/json",
                },
            });
        }

        if (url.pathname === "/tag" && req.method === "DELETE") {
            const tag = url.searchParams.get("tag") || "";
            if (!tag) {
                return new Response("Please provide a tag!", {
                    status: 400,
                    headers: {
                        ...corsHeaders,
                        "Content-Type": "application/json",
                    },
                });
            }
            console.log(`Deleting tag: ${tag}`);
            deleteTagByName(tag);
            return new Response("Deleted tag!", {
                status: 200,
                headers: {
                    ...corsHeaders,
                    "Content-Type": "application/json",
                },
            });
        }

        return new Response("404!", {
            status: 404,
            headers: {
                ...corsHeaders,
                "Content-Type": "application/json",
            },
        });
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

function add2autoreaderSQLite(url: string, tags: string[] = []) {
    const db = new Database("mydb.sqlite", { create: true });
    const createTableQuery = db.query(`
        CREATE TABLE IF NOT EXISTS autoreader (
        id TEXT PRIMARY KEY,
        url TEXT UNIQUE,
        date TEXT,
        read INTEGER,
        tags TEXT
        );
    `);
    createTableQuery.run();

    const tagsString = tags.join(',');
    const urlExistsQuery = db.query(`SELECT url FROM content WHERE url = ?`);
    const urlExists = urlExistsQuery.get(url);
    if (!urlExists) {
        // If URL does not exist, insert a new row
        const insertDataQuery = db.query(`
            INSERT INTO content (id, url, date, read, tags)
            VALUES (?, ?, ?, ?, ?)
        `);
        insertDataQuery.run(ulid(), url, new Date().toISOString(), 0, tagsString);
    }
    const countQuery = db.query(`SELECT COUNT(*) as count FROM content`);
    console.log(`Rows in the table: ${JSON.stringify(countQuery.get())}`);
}

function getRowsFromSQLite(pageNumber: number, pageCount: number) {
    const db = new Database("mydb.sqlite", { create: true });
    const selectQuery = db.query(`
        SELECT * FROM content
        ORDER BY 
            CASE WHEN read = 0 THEN 0 ELSE 1 END,
            date ASC
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

function markUnReadInSQLite(id: string) {
    const db = new Database("mydb.sqlite", { create: true });
    const markReadQuery = db.query(`
        UPDATE content
        SET read = 0
        WHERE id = ?
    `);
    markReadQuery.run(id);
}

function updateTagList(tags: string[], id: string, append: boolean = false) {
    const db = new Database("mydb.sqlite", { create: true });
    let newTags: string;
    if (append) {
        const selectQuery = db.query(`SELECT tags FROM content WHERE id = ?`);
        const currentTags = (selectQuery.get(id) || {tags: ''}) as {tags: string};
        newTags = [...new Set([...currentTags.tags.split(','), ...tags])].join(',');
    } else {
        newTags = tags.join(',');
    }
    const updateQuery = db.query(`UPDATE content SET tags = ? WHERE id = ?`);
    updateQuery.run(newTags, id);
}

function getDBStats() {
    const db = new Database("mydb.sqlite", { create: true });
    const countQuery = db.query(`SELECT COUNT(*) as count FROM content`);
    const readCountQuery = db.query(`SELECT COUNT(*) as count FROM content WHERE read = 1`);
    const readCountQueryButWithTags = db.query(`SELECT COUNT(*) as count FROM content WHERE read = 1 AND tags != ""`);
    const readCountQueryButWithoutTags = db.query(`SELECT COUNT(*) as count FROM content WHERE read = 1 AND tags = ""`);
    const unreadCountQuery = db.query(`SELECT COUNT(*) as count FROM content WHERE read = 0`);
    const sizeQuery = db.query(`SELECT page_count * page_size as size FROM pragma_page_count(), pragma_page_size()`);
    const rows = countQuery.get();
    const readRows = readCountQuery.get();
    const readRowsButWithTags = readCountQueryButWithTags.get();
    const readRowsButWithoutTags = readCountQueryButWithoutTags.get();
    const unreadRows = unreadCountQuery.get();
    const size = sizeQuery.get() as {size: string};
    const sizeInMB = `${parseFloat(size.size) / 1024 / 1024} MB`;
    return {rows, readRows, unreadRows, sizeInMB, readRowsButWithTags, readRowsButWithoutTags};
}

function removeALLFromSQLite() {
    const db = new Database("mydb.sqlite", { create: true });
    const removeQuery = db.query(`
        DELETE FROM content
    `);
    removeQuery.run();
}

function removeMarkedReadFromSQLite(ignoreTags: boolean = false) {
    const db = new Database("mydb.sqlite", { create: true });
    let removeQuery;
    if (ignoreTags) {
        removeQuery = db.query(`
            DELETE FROM content
            WHERE read = 1
        `);
    } else {
        
        removeQuery = db.query(`
            DELETE FROM content
            WHERE read = 1 AND tags = ""
        `);
    }
    removeQuery.run();
}


// ---- New database for storing available tags with 
// const options = [
//     { value: 'explore', label: 'Explore' , color: '#FF5630'},
//     { value: 'add2anki', label: 'Add to Anki' , color: '#FFC400'},
//   ] and an optional AdditonalJsonDetails & group tags

function addToTagsTable(tag: string,label: string, color: string,  additionalJsonDetails: string="", groupTags: string[] = []) {
    // table name: tags
    // columns: id auto increment, tag text, additionalJsonDetails text, groupTags text, label text, color text

    console.log(`Adding tag: ${tag}`);
    
    const db = new Database("mydb.sqlite", { create: true });
    const createTableQuery = db.query(`
        CREATE TABLE IF NOT EXISTS tags (
        id INTEGER PRIMARY KEY,
        tag TEXT UNIQUE,
        additionalJsonDetails TEXT,
        groupTags TEXT,
        label TEXT,
        color TEXT
        );
    `);

    createTableQuery.run();

    const insertOrUpdateDataQuery = db.query(`
        INSERT OR REPLACE INTO tags (tag, additionalJsonDetails, groupTags, label, color)
        VALUES (?, ?, ?, ?, ?)
    `);

    insertOrUpdateDataQuery.run(tag, additionalJsonDetails, groupTags.join(','), label, color);

    const countQuery = db.query(`SELECT COUNT(*) as count FROM tags`);
    console.log(`Rows in the table: ${JSON.stringify(countQuery.get())}`);
}

function getTagsFromTable() {
    const db = new Database("mydb.sqlite", { create: true });
    const selectQuery = db.query(`
        SELECT * FROM tags
    `);
    const rows = selectQuery.all();
    return rows;
}

function deleteTagByName(tag: string) {
    const db = new Database("mydb.sqlite", { create: true });
    const deleteQuery = db.query(`
        DELETE FROM tags
        WHERE tag = ?
    `);
    deleteQuery.run(tag);
}



function trucateLogger(data: string){
    return data.length > 50 ? `${data.substring(0, 50)}...` : data;
}
  
console.log(`Listening on http://localhost:${server.port} ...`);