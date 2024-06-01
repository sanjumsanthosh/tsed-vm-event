const server = Bun.serve({
    port: 8083,
    async fetch(req) {
        const url = new URL(req.url);
        // if (url.pathname === "/") return new Response("Home page!");
        // if (url.pathname === "/blog") return new Response("Blog!");
        // http://140.245.24.43:8083/rest/webhook
        if (url.pathname === "/rest/webhook" && req.method === "POST") {
            // read body as plain text
            const body = await req.text();
            console.log(body);
            return new Response("Webhook!");
        }
        return new Response("404!");
      },
  });
  
  console.log(`Listening on http://localhost:${server.port} ...`);