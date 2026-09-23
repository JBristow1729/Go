export function formatTime(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0)
    throw new Error("Invalid duration");
  if (seconds === 0) return "Now";
  if (seconds < 60) return "In <1 minute";
  const minutes = Math.round(seconds / 60);
  return `In ${minutes} minute${minutes === 1 ? "" : "s"}`;
}
const manoeuvres = {
  0: ["left", "Turn left"],
  1: ["right", "Turn right"],
  2: ["left", "Sharp left"],
  3: ["right", "Sharp right"],
  4: ["slight-left", "Bear left"],
  5: ["slight-right", "Bear right"],
  6: ["straight", "Continue straight"],
  8: ["roundabout", "Exit roundabout"],
  9: ["uturn", "Make a U-turn"],
  12: ["slight-left", "Keep left"],
  13: ["slight-right", "Keep right"],
};
const ordinal = (n) =>
  `${n}${n % 100 >= 11 && n % 100 <= 13 ? "th" : { 1: "st", 2: "nd", 3: "rd" }[n % 10] || "th"}`;
export function normaliseRoute(raw) {
  const segments = raw?.routes?.[0]?.segments;
  if (
    !Array.isArray(segments) ||
    !segments.length ||
    segments.some((s) => !Array.isArray(s.steps) || !s.steps.length)
  )
    throw new Error("Invalid route");
  const steps = segments.flatMap((s) => s.steps);
  if (
    steps.length < 2 ||
    steps.at(-1).type !== 10 ||
    steps.slice(0, -1).some((s) => s.type === 10)
  )
    throw new Error("Incomplete route");
  const extras = raw.routes[0].extras;
  const ranges = extras?.waytypes?.values ?? extras?.waytype?.values;
  const pathTypes = {
    4: "path",
    5: "track",
    6: "cycleway",
    7: "footpath",
    8: "steps",
  };
  let currentRoad = "";
  return steps.map((s, i) => {
    formatTime(s.duration);
    if (
      !Number.isInteger(s.type) ||
      typeof s.instruction !== "string" ||
      !s.instruction.trim()
    )
      throw new Error("Invalid instruction");
    const road =
      typeof s.name === "string" && s.name.trim() && s.name !== "-"
        ? s.name
        : "";
    if (road) currentRoad = road;
    const start = s.way_points?.[0];
    const range =
      Array.isArray(ranges) && Number.isInteger(start)
        ? ranges.find((r) => Array.isArray(r) && r[0] <= start && start < r[1])
        : null;
    const pathType = range && pathTypes[range[2]];
    const roadLabel = road
      ? "On to " + road
      : pathType
        ? "On to " + pathType
        : currentRoad
          ? "On " + currentRoad
          : "Unnamed road";
    let kind = i === 0 ? "departure" : s.type === 10 ? "arrival" : "turn";
    let [icon, action] = manoeuvres[s.type] || ["neutral", s.instruction];
    if (kind === "departure") {
      icon = "departure";
      action = s.instruction;
    }
    if (s.type === 7) {
      icon = "roundabout";
      const words = {
        first: 1,
        second: 2,
        third: 3,
        fourth: 4,
        fifth: 5,
        sixth: 6,
        seventh: 7,
        eighth: 8,
        ninth: 9,
        tenth: 10,
        eleventh: 11,
        twelfth: 12,
      };
      const match = s.instruction.match(
        /(?:take|use)\s+(?:the\s+)?(\d{1,3}(?:st|nd|rd|th)?|first|second|third|fourth|fifth|sixth|seventh|eighth|ninth|tenth|eleventh|twelfth)\s+exit\b/i,
      );
      const parsed = match
        ? words[match[1].toLowerCase()] || parseInt(match[1], 10)
        : 0;
      const exit =
        Number.isInteger(s.exit_number) && s.exit_number > 0
          ? s.exit_number
          : parsed;
      if (!exit) throw new Error("Roundabout exit unavailable");
      action = `Take ${ordinal(exit)} exit`;
    }
    if (kind === "arrival") {
      icon = "arrival";
      action = "Arrived!";
    }
    return {
      time: i === 0 ? "Now" : formatTime(steps[i - 1].duration),
      icon,
      action,
      road: kind === "arrival" ? "" : road,
      roadLabel,
      fullText: s.instruction,
      kind,
    };
  });
}
