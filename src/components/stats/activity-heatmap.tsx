const LEVELS = ["#18181B", "#14532D", "#15803D", "#22C55E", "#00FF66"];

function level(count: number) {
  if (count === 0) return 0;
  if (count <= 1) return 1;
  if (count <= 3) return 2;
  if (count <= 6) return 3;
  return 4;
}

/** GitHub-style grid: one column per week, one row per weekday (UTC). */
export function ActivityHeatmap({ perDay, weeks }: { perDay: Record<string, number>; weeks: number }) {
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  // Start on the Sunday `weeks - 1` weeks back so the last column is this week.
  const start = new Date(today);
  start.setUTCDate(start.getUTCDate() - today.getUTCDay() - (weeks - 1) * 7);

  const columns = Array.from({ length: weeks }, (_, w) =>
    Array.from({ length: 7 }, (_, d) => {
      const date = new Date(start);
      date.setUTCDate(start.getUTCDate() + w * 7 + d);
      const key = date.toISOString().slice(0, 10);
      return { key, count: perDay[key] ?? 0, future: date > today };
    }),
  );

  return (
    <div>
      <div className="flex gap-1 overflow-x-auto">
        {columns.map((days, i) => (
          <div key={i} className="flex flex-col gap-1">
            {days.map((d) => (
              <div
                key={d.key}
                title={`${d.key}: ${d.count} submission${d.count === 1 ? "" : "s"}`}
                className="size-3.5 rounded-sm"
                style={{ background: d.future ? "transparent" : LEVELS[level(d.count)] }}
              />
            ))}
          </div>
        ))}
      </div>
      <div className="mt-3 flex items-center gap-1 text-xs text-muted-foreground">
        Less
        {LEVELS.map((c) => (
          <span key={c} className="size-3 rounded-sm" style={{ background: c }} />
        ))}
        More
      </div>
    </div>
  );
}
