import { notFound } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { PROBLEM_COLUMNS, type Framework, type Problem } from "@/lib/problems";
import { Workbench } from "@/components/workbench/workbench";

export default async function ProblemPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const supabase = await createClient();

  const { data: problem } = await supabase
    .from("problems")
    .select(`${PROBLEM_COLUMNS}, frameworks(runtime, name)`)
    .eq("slug", slug)
    .maybeSingle<Problem & { frameworks: Pick<Framework, "runtime" | "name"> }>();
  if (!problem) notFound();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { frameworks, ...rest } = problem;
  return <Workbench problem={rest} runtime={frameworks.runtime} frameworkName={frameworks.name} signedIn={!!user} />;
}
