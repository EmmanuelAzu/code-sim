"use client";

import { PolarAngleAxis, PolarGrid, PolarRadiusAxis, Radar, RadarChart, ResponsiveContainer, Tooltip } from "recharts";

export function MasteryRadar({ data }: { data: { framework: string; accuracy: number; xp: number }[] }) {
  if (data.every((d) => d.accuracy === 0)) {
    return <p className="text-sm text-muted-foreground">Submit a few solutions to see your accuracy.</p>;
  }
  return (
    <ResponsiveContainer>
      <RadarChart data={data} outerRadius="75%">
        <PolarGrid stroke="#27272A" />
        <PolarAngleAxis dataKey="framework" tick={{ fill: "#A1A1AA", fontSize: 12 }} />
        <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} />
        <Radar dataKey="accuracy" name="Accuracy %" stroke="#00FF66" fill="#00FF66" fillOpacity={0.25} />
        <Tooltip
          contentStyle={{ background: "#18181B", border: "1px solid #27272A", borderRadius: 8 }}
          formatter={(v) => `${v}%`}
        />
      </RadarChart>
    </ResponsiveContainer>
  );
}
