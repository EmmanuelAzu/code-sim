// Messages exchanged between the editor page and the sandboxed iframe.

export interface BrowserTest {
  name: string;
  /** Async function body. Has `require`, `React`, `render`, `act`, `click`, `type`, `expect` in scope. */
  code: string;
}

export interface BrowserTestSuite {
  /** File whose default export is rendered as the live preview, e.g. "App.jsx". */
  entry: string;
  tests: BrowserTest[];
}

export interface Judge0TestSuite {
  cases: { name: string; stdin: string; expected_output: string }[];
}

export interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
  durationMs: number;
}

export interface RunRequest {
  type: "run";
  runId: string;
  /** File name -> CommonJS code (already transformed by the parent). */
  modules: Record<string, string>;
  entry: string;
  tests: BrowserTest[];
}

export type SandboxMessage =
  | { type: "ready" }
  | {
      type: "result";
      runId: string;
      results: TestResult[];
      logs: string[];
      /** Set when a module failed to load, so no test could run. */
      fatal?: string;
    };
