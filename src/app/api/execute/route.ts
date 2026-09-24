import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/utils/supabase/server";
import { JUDGE0_LANGUAGES, runCase } from "@/lib/judge0";
import type { Judge0TestSuite } from "@/sandbox/protocol";

const ExecuteBody = z.object({
  problemId: z.uuid(),
  files: z.record(z.string(), z.string().max(100_000)),
  /** Record the result as a submission (Judge0 results are trusted server-side). */
  submit: z.boolean().default(false),
  timeSpentSeconds: z.number().int().min(0).max(86_400).optional(),
});

export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  // Remote execution costs money; require an account.
  if (!user) return NextResponse.json({ error: "Sign in to run code" }, { status: 401 });

  const parsed = ExecuteBody.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request body" }, { status: 422 });
  const { problemId, files, submit, timeSpentSeconds } = parsed.data;

  // Load the test suite from the database rather than trusting the client.
  const { data: problem } = await supabase
    .from("problems")
    .select("framework_id, test_suite")
    .eq("id", problemId)
    .maybeSingle();
  if (!problem) return NextResponse.json({ error: "Problem not found" }, { status: 404 });

  const language = JUDGE0_LANGUAGES[problem.framework_id];
  if (!language) {
    // JS/TS/React/Next.js problems run in the browser sandbox.
    return NextResponse.json({ error: "This problem runs client-side in the browser sandbox" }, { status: 400 });
  }
  if (!process.env.JUDGE0_API_URL) {
    return NextResponse.json({ error: "Remote runner is not configured (JUDGE0_API_URL)" }, { status: 503 });
  }

  const source = files[language.file];
  if (!source) return NextResponse.json({ error: `Missing ${language.file}` }, { status: 422 });

  const suite = problem.test_suite as Judge0TestSuite;
  let results;
  try {
    results = await Promise.all(suite.cases.slice(0, 20).map((c) => runCase(language.id, source, c)));
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Remote runner failed. Try again." }, { status: 502 });
  }

  const status = results.every((r) => r.passed)
    ? "passed"
    : results.some((r) => r.runtimeError)
      ? "runtime_error"
      : "failed";
  const executionTimeMs = results.reduce((sum, r) => sum + r.durationMs, 0);

  if (submit) {
    await supabase.from("user_submissions").insert({
      user_id: user.id,
      problem_id: problemId,
      status,
      execution_time_ms: executionTimeMs,
      time_spent_seconds: timeSpentSeconds,
      submitted_code: files,
    });
  }

  return NextResponse.json({
    status,
    executionTimeMs,
    results: results.map(({ name, passed, error, durationMs }) => ({ name, passed, error, durationMs })),
  });
}
