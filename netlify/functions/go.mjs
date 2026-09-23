import { getStore } from "@netlify/blobs";
import { createNetlifyStore } from "../../src/netlify-storage.mjs";
import { createApp } from "../../src/app.mjs";
import { createProvider } from "../../src/provider.mjs";
import { createDemoProvider } from "../../src/demo-provider.mjs";
import { renderPage } from "../../src/render.mjs";
export default async (request) => {
  try {
    const demo = process.env.GO_DEMO === "1";
    const store = createNetlifyStore(
      getStore({ name: "go-sessions", consistency: "strong" }),
    );
    return await createApp({
      store,
      provider: demo
        ? createDemoProvider()
        : createProvider({ apiKey: process.env.HEIGIT_API_KEY }),
      render: renderPage,
      secureCookies: true,
      demo,
    })(request);
  } catch {
    return new Response("Go is unavailable. Please try again.", {
      status: 503,
      headers: { "cache-control": "no-store" },
    });
  }
};
