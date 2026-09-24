"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import Editor, { type BeforeMount } from "@monaco-editor/react";
import ReactMarkdown from "react-markdown";
import { Group, Panel, Separator } from "react-resizable-panels";
import { Play, RotateCcw, Send } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { DIFFICULTY_STYLES, type Problem } from "@/lib/problems";
import { sandboxDocument, useSandbox } from "@/sandbox/use-sandbox";
import type { BrowserTestSuite, TestResult } from "@/sandbox/protocol";

type Status = "passed" | "failed" | "runtime_error";

interface RunState {
  status: Status;
  results: TestResult[];
  logs: string[];
  fatal?: string;
  totalMs: number;
}

const LANGUAGES: Record<string, string> = {
  js: "javascript",
  jsx: "javascript",
  ts: "typescript",
  tsx: "typescript",
  rs: "rust",
};

const defineTheme: BeforeMount = (monaco) => {
  monaco.editor.defineTheme("codesim", {
    base: "vs-dark",
    inherit: true,
    rules: [
      { token: "keyword", foreground: "D946EF" },
      { token: "string", foreground: "00FF66" },
      { token: "comment", foreground: "71717A", fontStyle: "italic" },
    ],
    colors: {
      "editor.background": "#09090B",
      "editor.lineHighlightBackground": "#18181B",
      "editorCursor.foreground": "#00FF66",
      "editor.selectionBackground": "#D946EF40",
    },
  });
  // Starter code is JSX/TSX; keep Monaco from flagging it as unknown syntax.
  const opts = { jsx: monaco.languages.typescript.JsxEmit.React, allowJs: true, allowNonTsExtensions: true };
  monaco.languages.typescript.typescriptDefaults.setCompilerOptions(opts);
  monaco.languages.typescript.javascriptDefaults.setCompilerOptions(opts);
  monaco.languages.typescript.typescriptDefaults.setDiagnosticsOptions({ noSemanticValidation: true });
  monaco.languages.typescript.javascriptDefaults.setDiagnosticsOptions({ noSemanticValidation: true });
};

function storageKey(slug: string) {
  return `codesim:${slug}:files`;
}

function loadDraft(slug: string, starter: Record<string, string>) {
  try {
    const saved = localStorage.getItem(storageKey(slug));
    if (saved) return { ...starter, ...JSON.parse(saved) } as Record<string, string>;
  } catch {
    // storage unavailable (private mode, blocked site data)
  }
  return starter;
}

export function Workbench({
  problem,
  runtime,
  frameworkName,
  signedIn,
}: {
  problem: Problem;
  runtime: "browser" | "judge0";
  frameworkName: string;
  signedIn: boolean;
}) {
  const fileNames = useMemo(() => Object.keys(problem.starter_code), [problem.starter_code]);
  const [files, setFiles] = useState(problem.starter_code);
  const [activeFile, setActiveFile] = useState(fileNames[0]);
  const [topTab, setTopTab] = useState<"problem" | "preview">("problem");
  const [run, setRun] = useState<RunState | null>(null);
  const [busy, setBusy] = useState<"run" | "submit" | null>(null);
  const [notice, setNotice] = useState("");
  const openedAt = useRef(0);
  const sandbox = useSandbox();
  // Built after mount: it needs window.location.origin, and must match on hydration.
  const [srcDoc, setSrcDoc] = useState<string>();

  useEffect(() => {
    openedAt.current = Date.now();
    setSrcDoc(sandboxDocument(window.location.origin));
    setFiles(loadDraft(problem.slug, problem.starter_code));
  }, [problem.slug, problem.starter_code]);

  function updateFile(value: string | undefined) {
    const next = { ...files, [activeFile]: value ?? "" };
    setFiles(next);
    try {
      localStorage.setItem(storageKey(problem.slug), JSON.stringify(next));
    } catch {
      // ignore
    }
  }

  function reset() {
    setFiles(problem.starter_code);
    setRun(null);
    try {
      localStorage.removeItem(storageKey(problem.slug));
    } catch {
      // ignore
    }
  }

  async function execute(submit: boolean): Promise<RunState | null> {
    if (runtime === "browser") {
      const outcome = await sandbox.run(files, problem.test_suite as BrowserTestSuite);
      const allPassed = !outcome.fatal && outcome.results.length > 0 && outcome.results.every((r) => r.passed);
      const status: Status = allPassed ? "passed" : outcome.fatal ? "runtime_error" : "failed";
      return { status, results: outcome.results, logs: outcome.logs, fatal: outcome.fatal, totalMs: outcome.totalMs };
    }

    const res = await fetch("/api/execute", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        problemId: problem.id,
        files,
        submit,
        timeSpentSeconds: Math.round((Date.now() - openedAt.current) / 1000),
      }),
    });
    const json = await res.json();
    if (!res.ok) {
      setNotice(json.error ?? "Runner failed");
      return null;
    }
    return { status: json.status, results: json.results, logs: [], totalMs: json.executionTimeMs };
  }

  async function onRun() {
    setBusy("run");
    setNotice("");
    const result = await execute(false);
    if (result) setRun(result);
    setBusy(null);
  }

  async function onSubmit() {
    if (!signedIn) {
      setNotice("Sign in to submit and earn XP.");
      return;
    }
    setBusy("submit");
    setNotice("");
    const result = await execute(true);
    if (result) {
      setRun(result);
      if (runtime === "browser") {
        const res = await fetch("/api/submissions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            problemId: problem.id,
            status: result.status,
            executionTimeMs: Math.round(result.totalMs),
            timeSpentSeconds: Math.round((Date.now() - openedAt.current) / 1000),
            files,
          }),
        });
        if (!res.ok) setNotice((await res.json().catch(() => ({}))).error ?? "Could not save submission");
      }
      if (result.status === "passed") setNotice("Submitted. Nice work!");
      openedAt.current = Date.now();
    }
    setBusy(null);
  }

  const passedCount = run?.results.filter((r) => r.passed).length ?? 0;

  return (
    <div className="h-[calc(100dvh-57px)]">
      <Group orientation="horizontal">
        <Panel defaultSize="55" minSize="25">
          <div className="flex h-full flex-col">
            <div className="flex items-center gap-1 border-b border-border px-2">
              {fileNames.map((name) => (
                <button
                  key={name}
                  onClick={() => setActiveFile(name)}
                  className={cn(
                    "border-b-2 px-3 py-2 font-mono text-xs",
                    name === activeFile ? "border-primary text-foreground" : "border-transparent text-muted-foreground",
                  )}
                >
                  {name}
                </button>
              ))}
              <div className="ml-auto flex gap-2 py-1.5">
                <Button size="sm" variant="ghost" onClick={reset} title="Reset to starter code">
                  <RotateCcw />
                </Button>
                <Button size="sm" variant="outline" onClick={onRun} disabled={busy !== null || (runtime === "browser" && !sandbox.ready)}>
                  <Play /> {busy === "run" ? "Running…" : "Run"}
                </Button>
                <Button size="sm" onClick={onSubmit} disabled={busy !== null || (runtime === "browser" && !sandbox.ready)}>
                  <Send /> {busy === "submit" ? "Submitting…" : "Submit"}
                </Button>
              </div>
            </div>
            <div className="min-h-0 flex-1">
              <Editor
                path={`${problem.slug}/${activeFile}`}
                language={LANGUAGES[activeFile.split(".").pop() ?? ""] ?? "plaintext"}
                value={files[activeFile]}
                onChange={updateFile}
                theme="codesim"
                beforeMount={defineTheme}
                options={{ fontSize: 14, minimap: { enabled: false }, scrollBeyondLastLine: false, tabSize: 2 }}
              />
            </div>
          </div>
        </Panel>
        <Separator className="w-1 bg-border transition-colors hover:bg-primary data-[separator-state=drag]:bg-primary" />
        <Panel minSize="25">
          <Group orientation="vertical">
            <Panel defaultSize="60" minSize="20">
              <div className="flex h-full flex-col">
                <div className="flex border-b border-border px-2">
                  {(["problem", ...(runtime === "browser" ? ["preview"] : [])] as const).map((tab) => (
                    <button
                      key={tab}
                      onClick={() => setTopTab(tab as "problem" | "preview")}
                      className={cn(
                        "border-b-2 px-3 py-2 text-xs capitalize",
                        tab === topTab ? "border-secondary text-foreground" : "border-transparent text-muted-foreground",
                      )}
                    >
                      {tab}
                    </button>
                  ))}
                </div>
                <div className={cn("min-h-0 flex-1 overflow-y-auto p-5", topTab !== "problem" && "hidden")}>
                  <div className="mb-4 flex flex-wrap items-center gap-2">
                    <Link href={`/problems?framework=${problem.framework_id}`} className="font-mono text-xs text-muted-foreground hover:text-primary">
                      {frameworkName}
                    </Link>
                    <Badge variant="outline" className={DIFFICULTY_STYLES[problem.difficulty]}>
                      {problem.difficulty}
                    </Badge>
                    {problem.concept_tags.map((t) => (
                      <span key={t} className="rounded bg-zinc-800 px-1.5 py-0.5 font-mono text-xs text-muted-foreground">
                        {t}
                      </span>
                    ))}
                  </div>
                  <article className="prose-sim">
                    <ReactMarkdown>{problem.description_md}</ReactMarkdown>
                  </article>
                </div>
                {runtime === "browser" && (
                  <iframe
                    key={sandbox.frameKey}
                    ref={sandbox.iframeRef}
                    title="Preview"
                    // No allow-same-origin: user code gets an opaque origin and can't touch our cookies.
                    sandbox="allow-scripts"
                    srcDoc={srcDoc}
                    className={cn("min-h-0 w-full flex-1 bg-white", topTab !== "preview" && "hidden")}
                  />
                )}
              </div>
            </Panel>
            <Separator className="h-1 bg-border transition-colors hover:bg-primary data-[separator-state=drag]:bg-primary" />
            <Panel minSize="15">
              <div className="h-full overflow-y-auto p-4 font-mono text-xs">
                {notice && <p className="mb-3 text-secondary">{notice}</p>}
                {!run && !notice && <p className="text-muted-foreground">&gt; Run your code to see test results here.</p>}
                {run && (
                  <>
                    <p className={cn("mb-3 text-sm font-semibold", run.status === "passed" ? "text-primary" : "text-destructive")}>
                      {run.status === "passed" ? "✓ All tests passed" : `✗ ${passedCount}/${run.results.length} tests passed`}
                      <span className="ml-2 font-normal text-muted-foreground">{Math.round(run.totalMs)}ms</span>
                    </p>
                    {run.fatal && <p className="mb-2 text-destructive">{run.fatal}</p>}
                    <ul className="space-y-1.5">
                      {run.results.map((r) => (
                        <li key={r.name}>
                          <span className={r.passed ? "text-primary" : "text-destructive"}>{r.passed ? "PASS" : "FAIL"}</span>{" "}
                          {r.name}
                          {r.error && <div className="ml-10 text-zinc-400">{r.error}</div>}
                        </li>
                      ))}
                    </ul>
                    {run.logs.length > 0 && (
                      <pre className="mt-4 border-t border-border pt-3 whitespace-pre-wrap text-zinc-400">{run.logs.join("\n")}</pre>
                    )}
                  </>
                )}
              </div>
            </Panel>
          </Group>
        </Panel>
      </Group>
    </div>
  );
}
