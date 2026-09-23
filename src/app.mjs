import { createHash } from "node:crypto";
import { createSessions, cookieId, TTL } from "./sessions.mjs";
import { normaliseRoute } from "./instructions.mjs";
const headers = {
  "content-type": "text/html; charset=utf-8",
  "cache-control": "private, no-store",
  "referrer-policy": "no-referrer",
  "x-content-type-options": "nosniff",
  "content-security-policy":
    "default-src 'self'; script-src 'none'; style-src 'self'; img-src 'self'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'",
};
const messages = {
  configuration: "Directions need setup. Please try later.",
  input: "Check the place and try again.",
  quota: "Search limit reached. Try again shortly.",
  unavailable: "Service unavailable. Please try again.",
  "invalid-data": "Directions unavailable. Please try again.",
  "no-route": "No route found for this mode.",
};
export function createApp({
  provider,
  store,
  render,
  now = Date.now,
  secureCookies = false,
  demo = false,
}) {
  const sessions = createSessions({ store, now });
  const page = (view, model = {}, status = 200) =>
    new Response(render(view, { demo, ...model }), { status, headers });
  const redirect = (path) =>
    new Response(null, {
      status: 303,
      headers: { ...headers, location: path },
    });
  const fail = (message, status = 400, back = "/") =>
    page("error", { message, back }, status);
  async function dispatch(request) {
    const url = new URL(request.url),
      path = url.pathname;
    if (!["GET", "POST"].includes(request.method))
      return fail("Method not allowed.", 405);
    if (request.method === "GET" && path === "/") return page("start");
    if (
      request.method === "GET" &&
      ["/about", "/privacy", "/credits"].includes(path)
    )
      return page(path.slice(1));
    if (request.method === "POST") {
      const origin = request.headers.get("origin");
      if (origin && origin !== "null" && origin !== url.origin)
        return fail("Please reopen Go.", 403);
      if (
        !request.headers
          .get("content-type")
          ?.startsWith("application/x-www-form-urlencoded")
      )
        return fail("Unsupported form.", 415);
    }
    let form = null;
    if (request.method === "POST") {
      const reader = request.body?.getReader();
      let total = 0,
        parts = [];
      if (reader)
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          total += value.byteLength;
          if (total > 8192) {
            await reader.cancel();
            return fail("Input too long.", 413);
          }
          parts.push(value);
        }
      form = new URLSearchParams(Buffer.concat(parts).toString("utf8"));
    }
    if (request.method === "POST" && path === "/start") {
      const s = await sessions.create();
      const res = redirect("/from");
      res.headers.set(
        "set-cookie",
        `go_session=${s.id}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${TTL / 1000}${secureCookies ? "; Secure" : ""}`,
      );
      return res;
    }
    const id = cookieId(request);
    if (!id) return fail("Journey expired or cookies disabled.", 410);
    const release = await store.acquire(id, now());
    if (!release)
      return fail(
        "Still working. Please try again.",
        409,
        path.startsWith("/journey") ? "/ready" : "/from",
      );
    try {
      const s = await sessions.load(id);
      if (!s) return fail("Journey expired.", 410);
      const model = (extra) => ({ session: s, ...extra });
      const input = (side, message = "", status = 200) =>
        page("input", model({ side, message }), status);
      if (request.method === "GET") {
        if (path === "/from") return input("from");
        if (path === "/to") return s.from ? input("to") : redirect("/from");
        if (path === "/how")
          return s.from && s.to
            ? page("how", model())
            : redirect(s.from ? "/to" : "/from");
        if (path === "/ready")
          return s.cards.length
            ? page("ready", model())
            : redirect(s.from && s.to ? "/how" : "/from");
        const match = path.match(/^\/results\/(from|to)$/);
        if (match) {
          const side = match[1];
          if (side === "to" && !s.from) return redirect("/from");
          const detail = url.searchParams.get("detail");
          if (detail !== null) {
            const index = Number(detail);
            if (
              !/^\d+$/.test(detail) ||
              !s.candidates[side][index] ||
              url.searchParams.get("revision") !== String(s.revision)
            )
              return fail("Results changed. Search again.", 409, "/" + side);
            return page(
              "place",
              model({ side, index, place: s.candidates[side][index] }),
            );
          }
          return page("results", model({ side }));
        }
        if (path === "/journey") {
          if (!s.cards.length) return redirect("/how");
          const value = url.searchParams.get("step") ?? "0",
            step = Number(value);
          if (!/^\d+$/.test(value) || !s.cards[step])
            return fail("Instruction not found.", 400, "/ready");
          return page(
            "journey",
            model({
              card: s.cards[step],
              step,
              total: s.cards.length,
              expanded: url.searchParams.get("expanded") === "1",
            }),
          );
        }
        return fail("Page not found.", 404);
      }
      if (form.get("csrf") !== s.csrf)
        return fail("Form expired. Please go back.", 403, "/from");
      const submission = createHash("sha256")
        .update(path + "\n" + form.toString())
        .digest("hex");
      if (s.completedSubmissions[submission])
        return redirect(s.completedSubmissions[submission]);
      if (form.get("revision") !== String(s.revision))
        return fail("Results changed. Please go back.", 409, "/from");
      const done = async (target) => {
        s.revision++;
        s.completedSubmissions[submission] = target;
        const keys = Object.keys(s.completedSubmissions);
        if (keys.length > 20) delete s.completedSubmissions[keys[0]];
        await sessions.save(s);
        return redirect(target);
      };
      const throttle = () => {
        s.apiTimes = s.apiTimes.filter((t) => t > now() - 60000);
        if (s.apiTimes.length >= 10) return false;
        s.apiTimes.push(now());
        return true;
      };
      const search = path.match(/^\/search\/(from|to)$/);
      if (search) {
        const side = search[1];
        if (side === "to" && !s.from) return redirect("/from");
        const q = (form.get("q") || "").trim();
        if (!q || q.length > 160)
          return input(side, "Enter a place (up to 160 letters).", 400);
        s[side + "Query"] = q;
        if (!throttle()) {
          await sessions.save(s);
          return input(side, messages.quota, 429);
        }
        try {
          s.candidates[side] = await provider.search(q);
        } catch (e) {
          await sessions.save(s);
          return input(
            side,
            messages[e.code] || messages.unavailable,
            e.code === "quota" ? 429 : 503,
          );
        }
        return done("/results/" + side);
      }
      const selection = path.match(/^\/select\/(from|to)$/);
      if (selection) {
        const side = selection[1],
          value = form.get("index") || "",
          index = Number(value);
        if (!/^\d+$/.test(value) || !s.candidates[side][index])
          return fail("Choose one of the results.", 400, "/results/" + side);
        if (side === "to" && !s.from) return redirect("/from");
        s[side] = s.candidates[side][index];
        s.cards = [];
        s.mode = null;
        s.completedSubmissions = {};
        if (side === "from") {
          s.to = null;
          s.candidates.to = [];
        }
        return done(side === "from" ? "/to" : "/how");
      }
      if (path === "/mode") {
        if (!s.from || !s.to) return redirect(s.from ? "/to" : "/from");
        const mode = form.get("mode");
        if (!["walk", "drive"].includes(mode))
          return fail("Choose Walk or Drive.", 400, "/how");
        if (s.mode === mode && s.cards.length) return done("/ready");
        if (!throttle()) {
          await sessions.save(s);
          return page("how", model({ message: messages.quota }), 429);
        }
        try {
          s.cards = normaliseRoute(await provider.route(s.from, s.to, mode));
          s.mode = mode;
          return done("/ready");
        } catch (e) {
          await sessions.save(s);
          return page(
            "how",
            model({ message: messages[e.code] || messages.unavailable }),
            e.code === "no-route" ? 422 : 503,
          );
        }
      }
      return fail("Page not found.", 404);
    } catch {
      return fail("Go is unavailable. Please try again.", 503);
    } finally {
      await release();
    }
  }
  return async (request) => {
    const response = await dispatch(request);
    const id = cookieId(request);
    if (
      id &&
      !response.headers.has("set-cookie") &&
      response.status !== 410 &&
      response.status !== 503
    ) {
      response.headers.set(
        "set-cookie",
        `go_session=${id}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${TTL / 1000}${secureCookies ? "; Secure" : ""}`,
      );
    }
    return response;
  };
}
