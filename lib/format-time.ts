const formatter = new Intl.RelativeTimeFormat("en", { numeric: "auto" });

const UNITS: Array<{ unit: Intl.RelativeTimeFormatUnit; ms: number }> = [
  { unit: "year", ms: 365 * 24 * 60 * 60 * 1000 },
  { unit: "month", ms: 30 * 24 * 60 * 60 * 1000 },
  { unit: "week", ms: 7 * 24 * 60 * 60 * 1000 },
  { unit: "day", ms: 24 * 60 * 60 * 1000 },
  { unit: "hour", ms: 60 * 60 * 1000 },
  { unit: "minute", ms: 60 * 1000 },
  { unit: "second", ms: 1000 },
];

export function relativeTime(date: Date | string | null | undefined): string {
  if (!date) return "Never";
  const target = typeof date === "string" ? new Date(date) : date;
  const diff = target.getTime() - Date.now();
  for (const { unit, ms } of UNITS) {
    if (Math.abs(diff) >= ms || unit === "second") {
      return formatter.format(Math.round(diff / ms), unit);
    }
  }
  return "now";
}

export function isoDate(date: Date | string | null | undefined): string {
  if (!date) return "";
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toISOString().replace("T", " ").slice(0, 19) + " UTC";
}
