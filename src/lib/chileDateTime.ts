/** Fecha/hora calendario Chile → ISO UTC (misma lógica que api/_lib/chileDateTime). */
export function chileLocalToUtcIso(date: string, time: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time)) return null;

  const [year, month, day] = date.split("-").map(Number);
  const [hour, minute] = time.split(":").map(Number);

  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Santiago",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  let guess = Date.UTC(year, month - 1, day, hour + 4, minute, 0);

  for (let i = 0; i < 32; i++) {
    const parts = Object.fromEntries(
      fmt.formatToParts(new Date(guess)).map((p) => [p.type, p.value]),
    );
    const py = Number(parts.year);
    const pm = Number(parts.month);
    const pd = Number(parts.day);
    const ph = Number(parts.hour);
    const pmin = Number(parts.minute);

    if (py === year && pm === month && pd === day && ph === hour && pmin === minute) {
      return new Date(guess).toISOString();
    }

    const targetMin = hour * 60 + minute;
    const actualMin = ph * 60 + pmin;
    let deltaMin = targetMin - actualMin;
    deltaMin += (day - pd) * 24 * 60;
    guess += deltaMin * 60_000;
  }

  return null;
}
