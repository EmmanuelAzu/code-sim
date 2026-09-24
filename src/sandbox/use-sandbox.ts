"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { BrowserTestSuite, RunRequest, SandboxMessage } from "./protocol";
import { toCommonJs, transformTest } from "./transform";

const TIMEOUT_MS = 8000;

export type RunOutcome = Extract<SandboxMessage, { type: "result" }> & { totalMs: number };

export function sandboxDocument(origin: string) {
  return `<!doctype html><html><head><meta charset="utf-8"><style>body{font-family:system-ui,sans-serif;margin:16px;color:#18181b;background:#fff}</style></head><body><div id="root"></div><script src="${origin}/sandbox/runtime.js"></script></body></html>`;
}

/** Drives the sandboxed iframe: transforms files, posts them in, awaits results. */
export function useSandbox() {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [ready, setReady] = useState(false);
  const [frameKey, setFrameKey] = useState(0);
  const pending = useRef<{ runId: string; resolve: (m: RunOutcome) => void; started: number } | null>(null);

  useEffect(() => {
    function onMessage(event: MessageEvent<SandboxMessage>) {
      if (event.source !== iframeRef.current?.contentWindow) return;
      if (event.data.type === "ready") setReady(true);
      if (event.data.type === "result" && pending.current?.runId === event.data.runId) {
        pending.current.resolve({ ...event.data, totalMs: performance.now() - pending.current.started });
        pending.current = null;
      }
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  const run = useCallback((files: Record<string, string>, suite: BrowserTestSuite) => {
    return new Promise<RunOutcome>((resolve) => {
      const started = performance.now();
      const runId = crypto.randomUUID();
      const fail = (fatal: string) =>
        resolve({ type: "result", runId, results: [], logs: [], fatal, totalMs: performance.now() - started });

      let request: RunRequest;
      try {
        request = {
          type: "run",
          runId,
          modules: toCommonJs(files),
          entry: suite.entry,
          tests: suite.tests.map((t) => ({ name: t.name, code: transformTest(t.code) })),
        };
      } catch (err) {
        return fail(`Syntax error: ${(err as Error).message}`);
      }

      pending.current = { runId, resolve, started };
      iframeRef.current?.contentWindow?.postMessage(request, "*");

      setTimeout(() => {
        if (pending.current?.runId !== runId) return;
        pending.current = null;
        // Replace the frame in case user code is stuck in a loop.
        setReady(false);
        setFrameKey((k) => k + 1);
        fail(`Timed out after ${TIMEOUT_MS / 1000}s. Is there an infinite loop?`);
      }, TIMEOUT_MS);
    });
  }, []);

  return { iframeRef, ready, frameKey, run };
}
