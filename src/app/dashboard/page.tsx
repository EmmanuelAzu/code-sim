import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MasteryRadar } from "@/components/stats/mastery-radar";
import { ActivityHeatmap } from "@/components/stats/activity-heatmap";

const WEEKS = 16;

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/dashboard");

  const since = new Date(Date.now() - WEEKS * 7 * 86_400_000).toISOString();
  const [{ data: frameworks }, { data: stats }, { data: submissions }] = await Promise.all([
    supabase.from("frameworks").select("id, name").order("name"),
    supabase.from("user_framework_stats").select("framework_id, xp, problems_solved, time_spent_seconds").eq("user_id", user.id),
    supabase
      .from("user_submissions")
      .select("status, created_at, problems(framework_id)")
      .eq("user_id", user.id)
      .gte("created_at", since)
      .returns<{ status: string; created_at: string; problems: { framework_id: string } | null }[]>(),
  ]);

  const subs = submissions ?? [];
  const byFramework = (frameworks ?? []).map((f) => {
    const s = stats?.find((x) => x.framework_id === f.id);
    const attempts = subs.filter((x) => x.problems?.framework_id === f.id);
    const passed = attempts.filter((x) => x.status === "passed").length;
    return {
      framework: f.name,
      xp: s?.xp ?? 0,
      solved: s?.problems_solved ?? 0,
      accuracy: attempts.length ? Math.round((passed / attempts.length) * 100) : 0,
    };
  });

  const perDay: Record<string, number> = {};
  for (const s of subs) {
    const day = s.created_at.slice(0, 10);
    perDay[day] = (perDay[day] ?? 0) + 1;
  }

  const totalXp = byFramework.reduce((a, b) => a + b.xp, 0);
  const totalSolved = byFramework.reduce((a, b) => a + b.solved, 0);
  const minutes = Math.round((stats ?? []).reduce((a, b) => a + (b.time_spent_seconds ?? 0), 0) / 60);

  return (
    <main className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-10">
      <h1 className="text-2xl font-bold">Your progress</h1>
      <div className="grid gap-4 sm:grid-cols-3">
        {[
          ["Total XP", totalXp],
          ["Problems solved", totalSolved],
          ["Minutes coding", minutes],
        ].map(([label, value]) => (
          <Card key={label}>
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground">{label}</p>
              <p className="font-mono text-3xl font-bold text-primary">{value}</p>
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Accuracy by framework</CardTitle>
          </CardHeader>
          <CardContent className="h-80">
            <MasteryRadar data={byFramework} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Activity · last {WEEKS} weeks</CardTitle>
          </CardHeader>
          <CardContent>
            <ActivityHeatmap perDay={perDay} weeks={WEEKS} />
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
