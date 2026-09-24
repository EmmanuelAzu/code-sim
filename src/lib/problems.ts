import type { BrowserTestSuite, Judge0TestSuite } from "@/sandbox/protocol";

// solution_code is not granted to clients, so never `select("*")` on problems.
export const PROBLEM_COLUMNS =
  "id, framework_id, title, slug, difficulty, concept_tags, description_md, starter_code, test_suite, created_at";

export type Difficulty = "beginner" | "intermediate" | "advanced";

export interface Problem {
  id: string;
  framework_id: string;
  title: string;
  slug: string;
  difficulty: Difficulty;
  concept_tags: string[];
  description_md: string;
  starter_code: Record<string, string>;
  test_suite: BrowserTestSuite | Judge0TestSuite;
  created_at: string;
}

export interface Framework {
  id: string;
  name: string;
  description: string | null;
  icon_url: string | null;
  runtime: "browser" | "judge0";
}

export const DIFFICULTY_STYLES: Record<Difficulty, string> = {
  beginner: "border-primary/40 text-primary",
  intermediate: "border-secondary/50 text-secondary",
  advanced: "border-destructive/50 text-destructive",
};
