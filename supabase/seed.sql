-- CodeSim seed data: frameworks and starter problems.

insert into frameworks (id, name, description, runtime) values
  ('react', 'React', 'Components, hooks and state.', 'browser'),
  ('nextjs', 'Next.js', 'App Router patterns, routing and data.', 'browser'),
  ('typescript', 'TypeScript', 'Types, generics and narrowing.', 'browser'),
  ('rust', 'Rust', 'Ownership, borrowing and zero-cost abstractions.', 'judge0')
on conflict (id) do update set name = excluded.name, description = excluded.description, runtime = excluded.runtime;

insert into problems (framework_id, title, slug, difficulty, concept_tags, description_md, starter_code, solution_code, test_suite) values (
  'react', 'Click Counter', 'react-click-counter', 'beginner',
  array['useState', 'Events'],
  '# Click Counter

Build a counter with `useState`.

- Show the text **`Count: N`** inside an element with `data-testid="count"`, starting at `0`.
- A button labelled **`+1`** increments the count.
- A button labelled **`Reset`** sets it back to `0`.
',
  $json${"App.jsx": "import { useState } from \"react\";\n\nexport default function App() {\n  // TODO: keep track of the count\n  return (\n    <div>\n      <p data-testid=\"count\">Count: 0</p>\n      <button>+1</button>\n      <button>Reset</button>\n    </div>\n  );\n}\n"}$json$::jsonb,
  $json${"App.jsx": "import { useState } from \"react\";\n\nexport default function App() {\n  const [count, setCount] = useState(0);\n  return (\n    <div>\n      <p data-testid=\"count\">Count: {count}</p>\n      <button onClick={() => setCount((c) => c + 1)}>+1</button>\n      <button onClick={() => setCount(0)}>Reset</button>\n    </div>\n  );\n}\n"}$json$::jsonb,
  $json${"entry": "App.jsx", "tests": [{"name": "starts at zero", "code": "const App = require(\"./App\").default;\nconst root = await render(<App />);\nexpect(root.querySelector('[data-testid=\"count\"]').textContent).toBe(\"Count: 0\");"}, {"name": "+1 increments", "code": "const App = require(\"./App\").default;\nconst root = await render(<App />);\nconst plus = [...root.querySelectorAll(\"button\")].find((b) => b.textContent === \"+1\");\nawait click(plus);\nawait click(plus);\nexpect(root.querySelector('[data-testid=\"count\"]').textContent).toBe(\"Count: 2\");"}, {"name": "Reset goes back to zero", "code": "const App = require(\"./App\").default;\nconst root = await render(<App />);\nconst buttons = [...root.querySelectorAll(\"button\")];\nawait click(buttons.find((b) => b.textContent === \"+1\"));\nawait click(buttons.find((b) => b.textContent === \"Reset\"));\nexpect(root.querySelector('[data-testid=\"count\"]').textContent).toBe(\"Count: 0\");"}]}$json$::jsonb
) on conflict (slug) do nothing;

insert into problems (framework_id, title, slug, difficulty, concept_tags, description_md, starter_code, solution_code, test_suite) values (
  'react', 'Controlled Todo List', 'react-controlled-todo', 'intermediate',
  array['Controlled inputs', 'Lists & keys', 'useState'],
  '# Controlled Todo List

Build a todo list driven by a **controlled input**.

- An `<input>` and an **`Add`** button. Clicking `Add` appends the trimmed text as an `<li>` and clears the input.
- Blank or whitespace-only input must not add anything.
- Show `N remaining` in an element with `data-testid="remaining"`.
- Clicking an `<li>` removes it.
',
  $json${"App.jsx": "import { useState } from \"react\";\n\nexport default function App() {\n  return (\n    <div>\n      <input placeholder=\"What needs doing?\" />\n      <button>Add</button>\n      <ul></ul>\n      <p data-testid=\"remaining\">0 remaining</p>\n    </div>\n  );\n}\n"}$json$::jsonb,
  $json${"App.jsx": "import { useState } from \"react\";\n\nexport default function App() {\n  const [text, setText] = useState(\"\");\n  const [todos, setTodos] = useState([]);\n\n  function add() {\n    const value = text.trim();\n    if (!value) return;\n    setTodos((t) => [...t, { id: crypto.randomUUID(), value }]);\n    setText(\"\");\n  }\n\n  return (\n    <div>\n      <input placeholder=\"What needs doing?\" value={text} onChange={(e) => setText(e.target.value)} />\n      <button onClick={add}>Add</button>\n      <ul>\n        {todos.map((t) => (\n          <li key={t.id} onClick={() => setTodos((all) => all.filter((x) => x.id !== t.id))}>\n            {t.value}\n          </li>\n        ))}\n      </ul>\n      <p data-testid=\"remaining\">{todos.length} remaining</p>\n    </div>\n  );\n}\n"}$json$::jsonb,
  $json${"entry": "App.jsx", "tests": [{"name": "adds a trimmed todo and clears the input", "code": "const App = require(\"./App\").default;\nconst root = await render(<App />);\nconst input = root.querySelector(\"input\");\nawait type(input, \"  buy milk  \");\nawait click([...root.querySelectorAll(\"button\")].find((b) => b.textContent === \"Add\"));\nexpect([...root.querySelectorAll(\"li\")].map((li) => li.textContent)).toEqual([\"buy milk\"]);\nexpect(input.value).toBe(\"\");\nexpect(root.querySelector('[data-testid=\"remaining\"]').textContent).toBe(\"1 remaining\");"}, {"name": "ignores blank input", "code": "const App = require(\"./App\").default;\nconst root = await render(<App />);\nawait type(root.querySelector(\"input\"), \"   \");\nawait click([...root.querySelectorAll(\"button\")].find((b) => b.textContent === \"Add\"));\nexpect(root.querySelectorAll(\"li\").length).toBe(0);"}, {"name": "clicking a todo removes it", "code": "const App = require(\"./App\").default;\nconst root = await render(<App />);\nconst add = [...root.querySelectorAll(\"button\")].find((b) => b.textContent === \"Add\");\nawait type(root.querySelector(\"input\"), \"a\");\nawait click(add);\nawait type(root.querySelector(\"input\"), \"b\");\nawait click(add);\nawait click(root.querySelector(\"li\"));\nexpect([...root.querySelectorAll(\"li\")].map((li) => li.textContent)).toEqual([\"b\"]);\nexpect(root.querySelector('[data-testid=\"remaining\"]').textContent).toBe(\"1 remaining\");"}]}$json$::jsonb
) on conflict (slug) do nothing;

insert into problems (framework_id, title, slug, difficulty, concept_tags, description_md, starter_code, solution_code, test_suite) values (
  'typescript', 'Type-safe groupBy', 'ts-group-by', 'intermediate',
  array['Generics', 'keyof', 'Record'],
  '# Type-safe `groupBy`

Implement `groupBy<T, K extends PropertyKey>(items: T[], keyFn: (item: T) => K): Record<K, T[]>`.

- Items keep their original order within each group.
- Return an empty object for an empty array.
',
  $json${"groupBy.ts": "export function groupBy<T, K extends PropertyKey>(items: T[], keyFn: (item: T) => K): Record<K, T[]> {\n  // TODO\n  return {} as Record<K, T[]>;\n}\n"}$json$::jsonb,
  $json${"groupBy.ts": "export function groupBy<T, K extends PropertyKey>(items: T[], keyFn: (item: T) => K): Record<K, T[]> {\n  const groups = {} as Record<K, T[]>;\n  for (const item of items) {\n    const key = keyFn(item);\n    (groups[key] ??= []).push(item);\n  }\n  return groups;\n}\n"}$json$::jsonb,
  $json${"entry": "groupBy.ts", "tests": [{"name": "groups by key", "code": "const { groupBy } = require(\"./groupBy\");\nexpect(groupBy([1, 2, 3, 4, 5], (n) => (n % 2 ? \"odd\" : \"even\"))).toEqual({ odd: [1, 3, 5], even: [2, 4] });"}, {"name": "empty input", "code": "const { groupBy } = require(\"./groupBy\");\nexpect(groupBy([], (x) => x)).toEqual({});"}, {"name": "keeps order within a group", "code": "const { groupBy } = require(\"./groupBy\");\nconst people = [{ n: \"a\", t: 1 }, { n: \"b\", t: 2 }, { n: \"c\", t: 1 }];\nexpect(groupBy(people, (p) => p.t)[1].map((p) => p.n)).toEqual([\"a\", \"c\"]);"}]}$json$::jsonb
) on conflict (slug) do nothing;

insert into problems (framework_id, title, slug, difficulty, concept_tags, description_md, starter_code, solution_code, test_suite) values (
  'nextjs', 'Parse searchParams', 'nextjs-parse-search-params', 'beginner',
  array['searchParams', 'App Router'],
  '# Parse `searchParams`

In the App Router, a page receives `searchParams` where each value is `string | string[] | undefined`.
Write `parseFilters(searchParams)` for a product list page that returns:

```ts
{ q: string; page: number; tags: string[] }
```

- `q`: the first value, trimmed; `""` when missing.
- `page`: a positive integer; fall back to `1` for missing, non-numeric, or `< 1` values.
- `tags`: always an array (a single string becomes a one-item array); drop empty strings.
',
  $json${"filters.ts": "type SearchParams = Record<string, string | string[] | undefined>;\n\nexport function parseFilters(searchParams: SearchParams) {\n  // TODO\n  return { q: \"\", page: 1, tags: [] as string[] };\n}\n"}$json$::jsonb,
  $json${"filters.ts": "type SearchParams = Record<string, string | string[] | undefined>;\n\nconst first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);\n\nexport function parseFilters(searchParams: SearchParams) {\n  const q = (first(searchParams.q) ?? \"\").trim();\n  const n = Number(first(searchParams.page));\n  const page = Number.isInteger(n) && n >= 1 ? n : 1;\n  const raw = searchParams.tags;\n  const tags = (Array.isArray(raw) ? raw : raw === undefined ? [] : [raw]).filter((t) => t !== \"\");\n  return { q, page, tags };\n}\n"}$json$::jsonb,
  $json${"entry": "filters.ts", "tests": [{"name": "defaults when empty", "code": "const { parseFilters } = require(\"./filters\");\nexpect(parseFilters({})).toEqual({ q: \"\", page: 1, tags: [] });"}, {"name": "parses values", "code": "const { parseFilters } = require(\"./filters\");\nexpect(parseFilters({ q: \"  shoes \", page: \"3\", tags: [\"red\", \"\", \"sale\"] })).toEqual({ q: \"shoes\", page: 3, tags: [\"red\", \"sale\"] });"}, {"name": "single tag and bad page", "code": "const { parseFilters } = require(\"./filters\");\nexpect(parseFilters({ page: \"-2\", tags: \"new\" })).toEqual({ q: \"\", page: 1, tags: [\"new\"] });\nexpect(parseFilters({ page: \"abc\" }).page).toBe(1);\nexpect(parseFilters({ page: \"2.5\" }).page).toBe(1);"}]}$json$::jsonb
) on conflict (slug) do nothing;

insert into problems (framework_id, title, slug, difficulty, concept_tags, description_md, starter_code, solution_code, test_suite) values (
  'rust', 'Sum of Evens', 'rust-sum-of-evens', 'beginner',
  array['Iterators', 'Parsing stdin'],
  '# Sum of Evens

Read whitespace-separated integers from **stdin** and print the sum of the even ones.

```
input:  1 2 3 4
output: 6
```
',
  $json${"main.rs": "use std::io::{self, Read};\n\nfn main() {\n    let mut input = String::new();\n    io::stdin().read_to_string(&mut input).unwrap();\n    // TODO: print the sum of the even numbers\n}\n"}$json$::jsonb,
  $json${"main.rs": "use std::io::{self, Read};\n\nfn main() {\n    let mut input = String::new();\n    io::stdin().read_to_string(&mut input).unwrap();\n    let sum: i64 = input\n        .split_whitespace()\n        .filter_map(|s| s.parse::<i64>().ok())\n        .filter(|n| n % 2 == 0)\n        .sum();\n    println!(\"{}\", sum);\n}\n"}$json$::jsonb,
  $json${"cases": [{"name": "example", "stdin": "1 2 3 4", "expected_output": "6"}, {"name": "negatives", "stdin": "-2 -3 10", "expected_output": "8"}, {"name": "no evens", "stdin": "1 3 5", "expected_output": "0"}]}$json$::jsonb
) on conflict (slug) do nothing;
