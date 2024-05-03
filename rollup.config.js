import typescript from "@rollup/plugin-typescript";
import { defineConfig } from "rollup";
import dsv from "@rollup/plugin-dsv";
import { nodeResolve } from "@rollup/plugin-node-resolve";
import packageJson from "./package.json" assert { type: "json" };

const globals = {
  story: "story",
  zod: "Zod",
};

export default defineConfig({
  input: "src/main.ts",
  output: [
    {
      file: packageJson.module,
      format: "es",
      globals,
      sourcemap: true,
      exports: "named",
      name: packageJson.name,
    },
    {
      // For debugging
      file: "public/main.js",
      format: "es",
      globals,
      sourcemap: true,
      exports: "named",
      name: packageJson.name,
    },
    {
      file: packageJson.main,
      format: "umd",
      globals,
      sourcemap: true,
      exports: "named",
      name: packageJson.name,
    },
  ],
  plugins: [typescript(), dsv(), nodeResolve()],
});
