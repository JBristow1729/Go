export const escapeHtml = (value) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
export function compactText(value, limit = 24) {
  const chars = Array.from(String(value ?? ""));
  return chars.length > limit
    ? chars.slice(0, limit - 1).join("") + "…"
    : chars.join("");
}
// Conservative glyph budget also protects older browsers without text-overflow.
function compactLine(value, limit, pixels, fontSize) {
  const chars = Array.from(String(value ?? ""));
  let used = 0,
    out = "";
  for (const c of chars) {
    const units =
      /[MW@#%&]/.test(c) || c.codePointAt(0) > 255
        ? 1
        : /[ il.,'!:;]/.test(c)
          ? 0.35
          : 0.65;
    if (out.length >= limit - 1 || used + (units + 1) * fontSize > pixels)
      return out + "…";
    out += c;
    used += units * fontSize;
  }
  return out;
}
const e = escapeHtml;
const link = (href, label, cls = "") =>
  `<a${cls ? ` class="${cls}"` : ""} href="${e(href)}">${e(label)}</a>`;
const hidden = (name, value) =>
  `<input type="hidden" name="${name}" value="${e(value)}">`;
const form = (path, s, contents) =>
  `<form method="post" action="${path}">${s ? hidden("csrf", s.csrf) + hidden("revision", s.revision) : ""}${contents}</form>`;
const button = (label, attrs = "") =>
  `<button type="submit" ${attrs}>${e(label)}</button>`;
const icons = new Set([
  "straight",
  "left",
  "right",
  "slight-left",
  "slight-right",
  "roundabout",
  "uturn",
  "departure",
  "arrival",
  "neutral",
  "walk",
  "car",
]);
const icon = (name, alt = "") =>
  `<img class="icon" src="/icons/${icons.has(name) ? name : "neutral"}.png" width="40" height="40" alt="${e(alt)}">`;
const error = (message) =>
  message ? `<p class="message">${e(message)}</p>` : "";
export function renderPage(view, m = {}) {
  const s = m.session,
    side = m.side;
  let content = "",
    expanded = Boolean(m.expanded || view === "place");
  if (view === "start")
    content = `<div class="start">${form("/start", null, button("Start Journey", 'class="start-button" accesskey="1"'))}</div>`;
  else if (view === "input")
    content = `<h1><label for="q">${side === "from" ? "From:" : "To:"}</label></h1>${form("/search/" + side, s, `<input id="q" name="q" type="text" maxlength="160" value="${e(s[side + "Query"])}" autocomplete="off">${error(m.message)}${button("Next", 'class="primary" accesskey="1"')}`)}<nav>${link(side === "from" ? "/" : "/results/from", "Back")}</nav>`;
  else if (view === "results") {
    const places = s.candidates[side];
    content = `<h1>Choose ${side === "from" ? "start" : "destination"}</h1>`;
    content += places.length
      ? places
          .map(
            (p, i) =>
              `<div class="result">${form("/select/" + side, s, hidden("index", i) + `<button class="place-choice" type="submit" accesskey="${i + 1}"><span>${e(compactLine(p.name, 19, 178, 13))}</span><small>${e(compactLine(p.locality, 23, 178, 11))}</small></button>`)}${link(`/results/${side}?detail=${i}&revision=${s.revision}`, "…", "detail")}</div>`,
          )
          .join("")
      : '<p class="empty">No places found.</p>';
    content += `<nav>${link("/" + side, "Edit search")}</nav>`;
  } else if (view === "place")
    content = `<h1>Place details</h1><p class="full">${e(m.place.label)}</p>${form("/select/" + side, s, hidden("index", m.index) + button("Choose this place", 'class="primary"'))}<nav>${link("/results/" + side, "Show less")}</nav>`;
  else if (view === "how")
    content = `<h1>How?</h1>${error(m.message)}${form("/mode", s, `<div class="modes"><button name="mode" value="walk" accesskey="1">${icon("walk")}<span>Walk</span></button><button name="mode" value="drive" accesskey="2">${icon("car")}<span>Drive</span></button></div>`)}<nav>${link("/results/to", "Back")}</nav>`;
  else if (view === "ready")
    content = `<div class="ready"><h1>Ready!</h1>${link("/journey?step=0", "Begin", "primary")}<nav>${link("/how", "Back")}</nav></div>`;
  else if (view === "journey") {
    const c = m.card,
      base = `/journey?step=${m.step}`;
    const action = expanded
      ? e(c.action)
      : e(compactLine(c.action, 24, 222, 16));
    content = `<p class="time">${e(c.time)}</p>${icon(c.icon)}<h1 class="action">${action}</h1>`;
    {
      const road =
        c.kind === "arrival"
          ? "Arrival details…"
          : c.roadLabel || (c.road ? "On to " + c.road : "Unnamed road");
      content += expanded
        ? `<p class="full">${e(road)}</p><p class="full original">${e(c.fullText)}</p>${link(base, "Show less", "collapse")}`
        : `<p class="road">${link(base + "&expanded=1", compactLine(road, 27, 222, 14), "disclosure")}</p>`;
    }
    content += '<nav class="steps">';
    content +=
      m.step > 0
        ? link(`/journey?step=${m.step - 1}`, "Prev", "step-button")
        : '<span class="step-empty"></span>';
    content +=
      m.step < m.total - 1
        ? link(`/journey?step=${m.step + 1}`, "Next", "step-button")
        : form("/start", null, button("Start again", 'class="step-button"'));
    content += "</nav>";
  } else if (view === "error")
    content = `<h1>One moment</h1><p class="message">${e(m.message)}</p><nav>${link(m.back || "/", "Back", "primary")}</nav>`;
  else if (view === "about")
    content =
      '<h1>Go</h1><p class="info">Simple directions.<br>Walk or drive across the UK.</p><nav class="info-links">' +
      link("/privacy", "Privacy") +
      link("/credits", "Map credits") +
      link("/", "Home") +
      "</nav>";
  else if (view === "privacy")
    content =
      '<h1>Privacy</h1><p class="info">Places go to HeiGIT for directions. A cookie remembers your journey. It expires after 2 idle hours; cleanup follows within an hour. No analytics.</p><nav>' +
      link("/about", "Back") +
      "</nav>";
  else if (view === "credits")
    content =
      '<h1>Map credits</h1><p class="info">' +
      link(
        "https://www.openstreetmap.org/copyright",
        "© OpenStreetMap contributors",
      ) +
      "<br>" +
      link("https://heigit.org/", "Routing & search: HeiGIT") +
      "</p><nav>" +
      link("/about", "Back") +
      "</nav>";
  else content = "<h1>Page not found</h1>" + link("/", "Home");
  const foot =
    view === "start"
      ? ""
      : `<footer>${link("/credits", "© OpenStreetMap · HeiGIT")}${link("/about", "Go", "about")}</footer>`;
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="color-scheme" content="dark"><meta name="theme-color" content="#111111"><title>Go — simple directions</title><link rel="icon" href="/icons/straight.png"><link rel="stylesheet" href="/go.css?v=1"></head><body><main class="${expanded ? "expanded" : "compact"} ${view}">${m.demo ? '<div class="demo">Demo · sample journey</div>' : ""}${content}${foot}</main></body></html>`;
}
