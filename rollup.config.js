import typescript from "@rollup/plugin-typescript";
import { defineConfig } from "rollup";
import dsv from "@rollup/plugin-dsv";
import { nodeResolve } from "@rollup/plugin-node-resolve";

const globals = {
  story: "story",
  zod: "Zod",
};

export default defineConfig({
  input: "src/main.ts",
  output: [
    {
      format: "es",
      file: "dist/main.js",
      globals,
      sourcemap: true,
    },
    {
      // For debugging
      format: "es",
      file: "public/main.js",
      globals,
      sourcemap: true,
    },
    {
      format: "umd",
      file: "dist/main.umd.cjs",
      globals,
      name: "der-koerper-bot",
      sourcemap: true,
    },
  ],
  plugins: [typescript(), dsv(), nodeResolve()],
});
