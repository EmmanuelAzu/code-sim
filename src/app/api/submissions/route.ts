import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/utils/supabase/server";

// Records a browser-sandbox run. These results come from the client, so
// XP for JS problems is honour-system; see README "Trust model".
const SubmissionBody = z.object({
  problemId: z.uuid(),
  status: z.enum(["passed", "failed", "runtime_error"]),
  executionTimeMs: z.number().int().min(0).max(600_000),
  timeSpentSeconds: z.number().int().min(0).max(86_400).optional(),
  files: z.record(z.string(), z.string().max(100_000)),
});

export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in to submit" }, { status: 401 });

  const parsed = SubmissionBody.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request body" }, { status: 422 });
  const body = parsed.data;

  const { data: problem } = await supabase
    .from("problems")
    .select("id, frameworks(runtime)")
    .eq("id", body.problemId)
    .maybeSingle<{ id: string; frameworks: { runtime: string } | null }>();
  if (!problem) return NextResponse.json({ error: "Problem not found" }, { status: 404 });
  if (problem.frameworks?.runtime !== "browser") {
    // Server-run problems are recorded by /api/execute with a verified result.
    return NextResponse.json({ error: "Submit this problem through /api/execute" }, { status: 400 });
  }

  const { error } = await supabase.from("user_submissions").insert({
    user_id: user.id,
    problem_id: body.problemId,
    status: body.status,
    execution_time_ms: body.executionTimeMs,
    time_spent_seconds: body.timeSpentSeconds,
    submitted_code: body.files,
  });
  if (error) {
    console.error(error);
    return NextResponse.json({ error: "Could not save submission" }, { status: 500 });
  }

  return NextResponse.json({ success: true }, { status: 201 });
}
