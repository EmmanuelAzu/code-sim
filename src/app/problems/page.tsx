import Link from "next/link";
import { createClient } from "@/utils/supabase/server";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { DIFFICULTY_STYLES, PROBLEM_COLUMNS, type Framework, type Problem } from "@/lib/problems";

export default async function ProblemsPage({
  searchParams,
}: {
  searchParams: Promise<{ framework?: string | string[] }>;
}) {
  const { framework: raw } = await searchParams;
  const framework = Array.isArray(raw) ? raw[0] : raw;
  const supabase = await createClient();

  let query = supabase.from("problems").select(PROBLEM_COLUMNS).order("created_at");
  if (framework) query = query.eq("framework_id", framework);

  const [{ data: problems }, { data: frameworks }] = await Promise.all([
    query.returns<Problem[]>(),
    supabase.from("frameworks").select("id, name").order("name").returns<Pick<Framework, "id" | "name">[]>(),
  ]);

  const pill = (active: boolean) =>
    cn(
      "rounded-full border px-3 py-1 text-sm font-mono transition-colors",
      active ? "border-primary text-primary" : "border-border text-muted-foreground hover:text-foreground",
    );

  return (
    <main className="mx-auto max-w-5xl px-4 py-10">
      <h1 className="mb-6 text-2xl font-bold">Problems</h1>
      <nav className="mb-8 flex flex-wrap gap-2">
        <Link href="/problems" className={pill(!framework)}>
          all
        </Link>
        {(frameworks ?? []).map((f) => (
          <Link key={f.id} href={`/problems?framework=${f.id}`} className={pill(framework === f.id)}>
            {f.id}
          </Link>
        ))}
      </nav>
      <ul className="divide-y divide-border rounded-xl border border-border">
        {(problems ?? []).map((p) => (
          <li key={p.id}>
            <Link href={`/problems/${p.slug}`} className="flex flex-wrap items-center gap-3 px-4 py-4 hover:bg-muted">
              <span className="font-medium">{p.title}</span>
              <Badge variant="outline" className={DIFFICULTY_STYLES[p.difficulty]}>
                {p.difficulty}
              </Badge>
              <span className="ml-auto flex flex-wrap gap-1.5">
                {p.concept_tags.map((t) => (
                  <span key={t} className="rounded bg-zinc-800 px-1.5 py-0.5 font-mono text-xs text-muted-foreground">
                    {t}
                  </span>
                ))}
              </span>
            </Link>
          </li>
        ))}
        {!problems?.length && <li className="px-4 py-6 text-muted-foreground">No problems here yet.</li>}
      </ul>
    </main>
  );
}
