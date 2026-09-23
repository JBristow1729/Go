import http from "node:http";
import { readFile } from "node:fs/promises";
import { fileURLToPath, pathToFileURL } from "node:url";
import { resolve } from "node:path";
import { createApp } from "./app.mjs";
import { createProvider } from "./provider.mjs";
import { createFileStore } from "./storage.mjs";
import { renderPage } from "./render.mjs";
import { createDemoProvider } from "./demo-provider.mjs";
import { createSessions } from "./sessions.mjs";
const publicDir = fileURLToPath(new URL("../public/", import.meta.url));
export function createLocalServer({ provider, store, demo = false } = {}) {
  const handle = createApp({ provider, store, render: renderPage, demo });
  return http.createServer(async (req, res) => {
    try {
      const url = new URL(
        req.url,
        "http://" + (req.headers.host || "localhost"),
      );
      if (
        req.method === "GET" &&
        (url.pathname === "/go.css" ||
          /^\/icons\/[a-z-]+\.png$/.test(url.pathname))
      ) {
        try {
          const body = await readFile(resolve(publicDir, "." + url.pathname));
          res.writeHead(200, {
            "content-type": url.pathname.endsWith(".css")
              ? "text/css; charset=utf-8"
              : "image/png",
            "cache-control": "no-store",
          });
          return res.end(body);
        } catch {
          res.writeHead(404);
          return res.end("Not found");
        }
      }
      const chunks = [];
      let size = 0;
      for await (const chunk of req) {
        size += chunk.length;
        if (size > 8192) {
          res.writeHead(413);
          res.end("Input too long");
          return;
        }
        chunks.push(chunk);
      }
      const request = new Request(url, {
        method: req.method,
        headers: req.headers,
        ...(!["GET", "HEAD"].includes(req.method)
          ? { body: Buffer.concat(chunks) }
          : {}),
      });
      const response = await handle(request);
      res.writeHead(response.status, Object.fromEntries(response.headers));
      res.end(Buffer.from(await response.arrayBuffer()));
    } catch {
      res.writeHead(503, { "content-type": "text/plain" });
      res.end("Go is unavailable. Please try again.");
    }
  });
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  const demo = process.env.GO_DEMO === "1",
    store = createFileStore(
      process.env.GO_DATA_DIR ||
        fileURLToPath(new URL("../.data/", import.meta.url)),
    );
  const server = createLocalServer({
    store,
    demo,
    provider: demo
      ? createDemoProvider()
      : createProvider({ apiKey: process.env.HEIGIT_API_KEY }),
  });
  const sessions = createSessions({ store });
  await sessions.cleanup();
  setInterval(() => sessions.cleanup().catch(() => {}), 3600000).unref();
  server.listen(Number(process.env.PORT || 3000), "127.0.0.1", () =>
    console.log(
      `Go ${demo ? "DEMO (sample directions)" : "live mode"}: http://127.0.0.1:${server.address().port}`,
    ),
  );
}
