import { Database } from "bun:sqlite";



const server = Bun.serve({
    port: 8083,
    async fetch(req) {
        const url = new URL(req.url);
        if (url.pathname === "/rest/webhook" && req.method === "POST") {
            const body = await req.text();
            console.log(`Received request`);
            let data;
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
            saveToSQLite(data.url, data.data);
            return new Response("Received!");
        }
        return new Response("404!");
      },
});

function saveToSQLite(url: string, data: string) {
    const db = new Database(":memory:");
    const query = db.query("select 'Hello world' as message;");
    console.log(query.get());
}

function trucateLogger(data: string){
    return data.length > 50 ? `${data.substring(0, 50)}...` : data;
}
  
console.log(`Listening on http://localhost:${server.port} ...`);