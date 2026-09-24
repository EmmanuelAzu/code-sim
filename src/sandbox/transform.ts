import { transform } from "sucrase";

/** TS/JSX + ES modules -> CommonJS that the sandbox's require() can evaluate. */
export function toCommonJs(files: Record<string, string>) {
  const modules: Record<string, string> = {};
  for (const [name, code] of Object.entries(files)) {
    const isTs = /\.tsx?$/.test(name);
    modules[name] = transform(code, {
      transforms: isTs ? ["typescript", "jsx", "imports"] : ["jsx", "imports"],
      jsxRuntime: "classic",
      production: true,
      filePath: name,
    }).code;
  }
  return modules;
}

/** Test bodies may use JSX; they run as async function bodies, not modules. */
export function transformTest(code: string) {
  return transform(code, { transforms: ["jsx"], jsxRuntime: "classic", production: true }).code;
}
