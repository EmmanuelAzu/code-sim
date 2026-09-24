// Runs inside the sandboxed iframe (opaque origin, scripts only).
// Bundled by scripts/build-sandbox-runtime.mjs into public/sandbox/runtime.js.

import * as React from "react";
import * as ReactDOMClient from "react-dom/client";
import type { RunRequest, SandboxMessage, TestResult } from "./protocol";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const EXTENSIONS = ["", ".tsx", ".ts", ".jsx", ".js"];
const BUILTINS: Record<string, unknown> = { react: React, "react-dom/client": ReactDOMClient };

type ModuleExports = Record<string, unknown>;

function createRequire(sources: Record<string, string>) {
  const cache = new Map<string, ModuleExports>();

  function resolve(specifier: string) {
    const name = specifier.replace(/^\.\//, "");
    for (const ext of EXTENSIONS) {
      if (name + ext in sources) return name + ext;
    }
    throw new Error(`Cannot find module '${specifier}'`);
  }

  function require(specifier: string): unknown {
    if (specifier in BUILTINS) return BUILTINS[specifier];
    const file = resolve(specifier);
    const cached = cache.get(file);
    if (cached) return cached;

    const mod = { exports: {} as ModuleExports };
    cache.set(file, mod.exports);
    new Function("require", "module", "exports", "React", sources[file])(require, mod, mod.exports, React);
    cache.set(file, mod.exports);
    return mod.exports;
  }

  return require;
}

function format(value: unknown) {
  try {
    return typeof value === "string" ? JSON.stringify(value) : JSON.stringify(value) ?? String(value);
  } catch {
    return String(value);
  }
}

function expect(actual: unknown) {
  const fail = (message: string) => {
    throw new Error(message);
  };
  return {
    toBe: (expected: unknown) =>
      Object.is(actual, expected) || fail(`Expected ${format(actual)} to be ${format(expected)}`),
    toEqual: (expected: unknown) =>
      JSON.stringify(actual) === JSON.stringify(expected) ||
      fail(`Expected ${format(actual)} to equal ${format(expected)}`),
    toContain: (item: unknown) =>
      (typeof actual === "string" || Array.isArray(actual)) && actual.includes(item as never)
        ? true
        : fail(`Expected ${format(actual)} to contain ${format(item)}`),
    toBeTruthy: () => Boolean(actual) || fail(`Expected ${format(actual)} to be truthy`),
    toBeFalsy: () => !actual || fail(`Expected ${format(actual)} to be falsy`),
    toBeGreaterThan: (n: number) =>
      (actual as number) > n || fail(`Expected ${format(actual)} to be greater than ${n}`),
  };
}

const container = document.getElementById("root")!;
let root: ReactDOMClient.Root | null = null;

async function resetRoot() {
  if (root) {
    const old = root;
    await React.act(async () => old.unmount());
  }
  root = ReactDOMClient.createRoot(container);
  return root;
}

async function render(element: React.ReactElement) {
  const r = await resetRoot();
  await React.act(async () => r.render(element));
  return container;
}

async function click(el: Element | null) {
  if (!el) throw new Error("click(): element not found");
  await React.act(async () => {
    el.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
}

async function type(el: Element | null, value: string) {
  if (!(el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement)) {
    throw new Error("type(): expected an input or textarea");
  }
  // React tracks the value property, so set it through the native setter.
  const setter = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(el), "value")!.set!;
  await React.act(async () => {
    setter.call(el, value);
    el.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

const logs: string[] = [];
for (const level of ["log", "info", "warn", "error"] as const) {
  const original = console[level].bind(console);
  console[level] = (...args: unknown[]) => {
    logs.push(`[${level}] ${args.map((a) => (typeof a === "string" ? a : format(a))).join(" ")}`);
    original(...args);
  };
}

const AsyncFunction = Object.getPrototypeOf(async () => {}).constructor as new (
  ...args: string[]
) => (...args: unknown[]) => Promise<unknown>;

async function run(req: RunRequest): Promise<SandboxMessage> {
  logs.length = 0;
  const results: TestResult[] = [];

  for (const test of req.tests) {
    // Fresh module registry per test so module-level state doesn't leak.
    const require = createRequire(req.modules);
    const started = performance.now();
    try {
      const fn = new AsyncFunction("require", "React", "render", "act", "click", "type", "expect", test.code);
      await fn(require, React, render, React.act, click, type, expect);
      results.push({ name: test.name, passed: true, durationMs: performance.now() - started });
    } catch (err) {
      results.push({
        name: test.name,
        passed: false,
        error: err instanceof Error ? err.message : String(err),
        durationMs: performance.now() - started,
      });
    }
  }

  // Leave the user's app mounted as the live preview.
  let fatal: string | undefined;
  try {
    const entry = createRequire(req.modules)(req.entry) as { default?: React.ComponentType };
    if (entry.default) await render(React.createElement(entry.default));
    else await resetRoot();
  } catch (err) {
    fatal = err instanceof Error ? err.message : String(err);
  }

  return { type: "result", runId: req.runId, results, logs: [...logs], fatal };
}

window.addEventListener("message", async (event: MessageEvent<RunRequest>) => {
  // Only the embedding page may drive the sandbox.
  if (event.source !== window.parent || event.data?.type !== "run") return;
  const message = await run(event.data);
  window.parent.postMessage(message, "*");
});

window.parent.postMessage({ type: "ready" } satisfies SandboxMessage, "*");
