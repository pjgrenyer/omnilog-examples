// Pure, AWS-free window/tick maths — the part of this example worth unit
// testing without touching Lambda or OTLP at all.

/**
 * Whether `date` (read in UTC) falls inside the configured overnight window.
 * `startHour`/`endHour` are 0-23. A window that crosses midnight (e.g. 22 ->
 * 2) wraps; one that doesn't (e.g. 1 -> 5) is a plain range. Equal bounds is
 * a zero-width window that never runs, not a 24h one.
 */
export function isWithinWindow(date, startHour, endHour) {
  const hour = date.getUTCHours();
  if (startHour === endHour) return false;
  if (startHour < endHour) return hour >= startHour && hour < endHour;
  return hour >= startHour || hour < endHour;
}

/**
 * The calendar date (UTC, `YYYY-MM-DD`) the current window's run started on.
 * For a wrapping window (e.g. 22 -> 2), an hour before `endHour` is still
 * part of the run that started the previous calendar day.
 */
export function runIdFor(date, startHour, endHour) {
  const hour = date.getUTCHours();
  const wraps = startHour > endHour;
  const startedYesterday = wraps && hour < endHour;

  const runDate = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  if (startedYesterday) runDate.setUTCDate(runDate.getUTCDate() - 1);
  return runDate.toISOString().slice(0, 10);
}

/** Total window width in minutes, accounting for a wrap past midnight. */
export function windowMinutes(startHour, endHour) {
  const hours = startHour < endHour ? endHour - startHour : 24 - startHour + endHour;
  return hours * 60;
}

/**
 * How many documents a single tick should generate: the total target spread
 * evenly across every tick in the window. Deliberately stateless — no
 * cross-invocation counter to keep in sync — so `ceil()` means the last tick
 * of a night may overshoot the target slightly rather than any tick being
 * shorted by rounding.
 */
export function docsPerTick(totalDocs, windowMins, tickMinutes) {
  const ticks = Math.max(1, Math.round(windowMins / tickMinutes));
  return Math.ceil(totalDocs / ticks);
}
