/** Query parsing for the public `stats` function. Pure, so it can be unit tested. */

/** Returns the `date` query value if it is a real YYYY-MM-DD calendar date, else null. */
export function parseDate(raw: string | null): string | null {
  if (!raw || !/^\d{4}-\d{2}-\d{2}$/.test(raw)) return null
  const d = new Date(`${raw}T00:00:00Z`)
  return Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== raw ? null : raw
}
