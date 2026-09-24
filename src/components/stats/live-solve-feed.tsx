"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export interface SolveEvent {
  id: number;
  username: string;
  problem_title: string;
  framework_id: string;
  xp_awarded: number;
  created_at: string;
}

/** Recent first-time solves, streamed live via Supabase Realtime. */
export function LiveSolveFeed({ initial }: { initial: SolveEvent[] }) {
  const [events, setEvents] = useState(initial);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel("solve-feed")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "solve_feed" }, (payload) => {
        setEvents((prev) => [payload.new as SolveEvent, ...prev].slice(0, 15));
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <span className="relative flex size-2">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-primary opacity-75" />
            <span className="relative inline-flex size-2 rounded-full bg-primary" />
          </span>
          Live solves
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="space-y-2 font-mono text-xs">
          {events.map((e) => (
            <li key={e.id} className="animate-in fade-in slide-in-from-top-1">
              <span className="text-secondary">{e.username}</span> solved{" "}
              <span className="text-foreground">{e.problem_title}</span>{" "}
              <span className="text-primary">+{e.xp_awarded}xp</span>
            </li>
          ))}
          {events.length === 0 && <li className="text-muted-foreground">Waiting for the first solve…</li>}
        </ul>
      </CardContent>
    </Card>
  );
}
