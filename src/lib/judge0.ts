import type { TestResult } from "@/sandbox/protocol";

// Judge0 CE language ids: https://ce.judge0.com/languages
export const JUDGE0_LANGUAGES: Record<string, { id: number; file: string }> = {
  rust: { id: 73, file: "main.rs" },
};

interface Judge0Result {
  stdout: string | null;
  stderr: string | null;
  compile_output: string | null;
  message: string | null;
  time: string | null;
  status: { id: number; description: string };
}

function headers(): HeadersInit {
  const h: Record<string, string> = { "Content-Type": "application/json" };
  const key = process.env.JUDGE0_API_KEY;
  if (key) {
    // RapidAPI-hosted Judge0 vs. a self-hosted instance with AUTHN_TOKEN
    const url = new URL(process.env.JUDGE0_API_URL!);
    if (url.hostname.endsWith("rapidapi.com")) {
      h["X-RapidAPI-Key"] = key;
      h["X-RapidAPI-Host"] = url.hostname;
    } else {
      h["X-Auth-Token"] = key;
    }
  }
  return h;
}

/** Runs one test case synchronously (wait=true) and maps Judge0's status to a TestResult. */
export async function runCase(
  languageId: number,
  source: string,
  testCase: { name: string; stdin: string; expected_output: string },
): Promise<TestResult & { runtimeError: boolean }> {
  const res = await fetch(`${process.env.JUDGE0_API_URL}/submissions?base64_encoded=false&wait=true`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({
      source_code: source,
      language_id: languageId,
      stdin: testCase.stdin,
      expected_output: testCase.expected_output,
      cpu_time_limit: 2,
    }),
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) throw new Error(`Judge0 responded ${res.status}`);

  const r = (await res.json()) as Judge0Result;
  const durationMs = Math.round(Number(r.time ?? 0) * 1000);
  // 3 = Accepted, 4 = Wrong Answer, 5 = Time Limit, 6 = Compilation Error, 7+ = runtime errors
  if (r.status.id === 3) return { name: testCase.name, passed: true, durationMs, runtimeError: false };

  const detail =
    r.status.id === 4
      ? `Expected ${JSON.stringify(testCase.expected_output.trim())}, got ${JSON.stringify((r.stdout ?? "").trim())}`
      : (r.compile_output ?? r.stderr ?? r.message ?? "").trim();
  return {
    name: testCase.name,
    passed: false,
    error: `${r.status.description}${detail ? `: ${detail}` : ""}`,
    durationMs,
    runtimeError: r.status.id !== 4,
  };
}
