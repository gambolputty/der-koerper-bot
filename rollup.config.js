import typescript from "@rollup/plugin-typescript";
import terser from "@rollup/plugin-terser";
import { defineConfig } from "rollup";
import { nodeResolve } from "@rollup/plugin-node-resolve";
import packageJson from "./package.json" assert { type: "json" };
import copy from "rollup-plugin-copy";

export default defineConfig({
  external: ["fs", "path"],
  input: "src/index.ts",
  output: [
    {
      file: packageJson.module,
      format: "es",
      name: packageJson.name,
    },
    {
      file: packageJson.main,
      format: "umd",
      name: packageJson.name,
    },
  ],
  plugins: [
    typescript(),
    copy({
      targets: [{ src: "src/assets/sentences.csv", dest: "dist" }],
    }),
    nodeResolve(),
    terser(),
  ],
});
