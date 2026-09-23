import { normaliseRoute } from "./instructions.mjs";
export class ProviderError extends Error {
  constructor(code) {
    super(code);
    this.code = code;
  }
}
const error = (code) => {
  throw new ProviderError(code);
};
const point = (p) =>
  Array.isArray(p) &&
  p.length === 2 &&
  p.every(Number.isFinite) &&
  Math.abs(p[0]) <= 180 &&
  Math.abs(p[1]) <= 90;
export function createProvider({ apiKey, fetchImpl = fetch } = {}) {
  async function request(url, options = {}) {
    if (!apiKey) error("configuration");
    let response;
    try {
      response = await fetchImpl(url, {
        ...options,
        signal: AbortSignal.timeout(8000),
        headers: {
          Authorization: apiKey,
          "Content-Type": "application/json",
          ...options.headers,
        },
      });
    } catch {
      error("unavailable");
    }
    if ([401, 403].includes(response.status)) error("configuration");
    if (response.status === 429) error("quota");
    let data;
    try {
      data = await response.json();
    } catch {
      error(response.ok ? "invalid-data" : "unavailable");
    }
    if ([2009, 2010].includes(data?.error?.code)) error("no-route");
    if (!response.ok) error("unavailable");
    return data;
  }
  return {
    async search(text) {
      if (typeof text !== "string" || !text.trim() || text.trim().length > 160)
        error("input");
      const url = new URL("https://api.heigit.org/pelias/v1/search");
      url.search = new URLSearchParams({
        text: text.trim(),
        "boundary.country": "GBR",
        size: "3",
        "focus.point.lat": "50.989",
        "focus.point.lon": "-1.499",
      });
      const data = await request(url);
      if (!Array.isArray(data.features)) error("invalid-data");
      const seen = new Set();
      const results = [];
      for (const f of data.features) {
        const p = f?.properties,
          c = f?.geometry?.coordinates;
        if (
          !p ||
          p.country_a !== "GBR" ||
          !point(c) ||
          typeof p.name !== "string" ||
          !p.name.trim()
        )
          continue;
        const id = String(p.gid || p.id || `${p.name}:${c.join(",")}`);
        if (seen.has(id)) continue;
        seen.add(id);
        results.push({
          id,
          name: p.name,
          locality: String(
            p.locality || p.localadmin || p.region || "United Kingdom",
          ),
          label: String(p.label || p.name),
          coordinates: c,
        });
        if (results.length === 3) break;
      }
      return results;
    },
    async route(from, to, mode) {
      if (
        !point(from?.coordinates) ||
        !point(to?.coordinates) ||
        !["walk", "drive"].includes(mode)
      )
        error("input");
      const profile = mode === "walk" ? "foot-walking" : "driving-car";
      const data = await request(
        `https://api.heigit.org/openrouteservice/v2/directions/${profile}`,
        {
          method: "POST",
          body: JSON.stringify({
            coordinates: [from.coordinates, to.coordinates],
            language: "en",
            instructions: true,
            geometry: false,
            extra_info: ["waytype"],
          }),
        },
      );
      if (Array.isArray(data.routes) && !data.routes.length) error("no-route");
      try {
        normaliseRoute(data);
      } catch {
        error("invalid-data");
      }
      return data;
    },
  };
}
