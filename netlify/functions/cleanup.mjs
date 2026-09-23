import { getStore } from "@netlify/blobs";
import { createNetlifyStore } from "../../src/netlify-storage.mjs";
import { createSessions } from "../../src/sessions.mjs";
export default async () => {
  await createSessions({
    store: createNetlifyStore(
      getStore({ name: "go-sessions", consistency: "strong" }),
    ),
  }).cleanup();
  return new Response(null, { status: 204 });
};
export const config = { schedule: "0 * * * *" };
