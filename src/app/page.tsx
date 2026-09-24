import Link from "next/link";
import { createClient } from "@/utils/supabase/server";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LiveSolveFeed, type SolveEvent } from "@/components/stats/live-solve-feed";
import type { Framework } from "@/lib/problems";

export default async function Home() {
  const supabase = await createClient();
  const [frameworks, problems, feed, leaders] = await Promise.all([
    supabase.from("frameworks").select("*").order("name").returns<Framework[]>(),
    supabase.from("problems").select("framework_id"),
    supabase
      .from("solve_feed")
      .select("id, username, problem_title, framework_id, xp_awarded, created_at")
      .order("created_at", { ascending: false })
      .limit(15)
      .returns<SolveEvent[]>(),
    supabase.from("leaderboard").select("username, total_xp, problems_solved").order("total_xp", { ascending: false }).limit(10),
  ]);

  const counts = new Map<string, number>();
  for (const p of problems.data ?? []) counts.set(p.framework_id, (counts.get(p.framework_id) ?? 0) + 1);

  return (
    <main className="mx-auto max-w-7xl px-4 py-16">
      <section className="max-w-3xl">
        <p className="font-mono text-sm text-secondary">&gt;_ learn by shipping</p>
        <h1 className="mt-3 text-4xl font-bold tracking-tight sm:text-6xl">
          Master frameworks <span className="glow text-primary">one challenge</span> at a time.
        </h1>
        <p className="mt-4 text-lg text-muted-foreground">
          Real editor, real tests, instant feedback. Pick a framework and start solving.
        </p>
        <Button asChild size="lg" className="mt-8">
          <Link href="/problems">Browse problems</Link>
        </Button>
      </section>

      <div className="mt-16 grid gap-8 lg:grid-cols-[1fr_360px]">
        <section className="grid content-start gap-4 sm:grid-cols-2">
          {(frameworks.data ?? []).map((f) => (
            <Link key={f.id} href={`/problems?framework=${f.id}`}>
              <Card className="h-full transition-colors hover:border-primary">
                <CardHeader>
                  <CardTitle className="font-mono">{f.name}</CardTitle>
                  <CardDescription>{f.description}</CardDescription>
                </CardHeader>
                <CardContent className="text-sm text-muted-foreground">
                  {counts.get(f.id) ?? 0} problems · runs {f.runtime === "browser" ? "in your browser" : "on a remote runner"}
                </CardContent>
              </Card>
            </Link>
          ))}
        </section>

        <aside className="flex flex-col gap-6">
          <LiveSolveFeed initial={feed.data ?? []} />
          <Card>
            <CardHeader>
              <CardTitle>Top XP</CardTitle>
            </CardHeader>
            <CardContent>
              <ol className="space-y-2 text-sm">
                {(leaders.data ?? []).map((l, i) => (
                  <li key={l.username} className="flex justify-between font-mono">
                    <span>
                      <span className="text-muted-foreground">{String(i + 1).padStart(2, "0")}</span> {l.username}
                    </span>
                    <span className="text-primary">{l.total_xp} xp</span>
                  </li>
                ))}
                {!leaders.data?.length && <li className="text-muted-foreground">Be the first on the board.</li>}
              </ol>
            </CardContent>
          </Card>
        </aside>
      </div>
    </main>
  );
}
