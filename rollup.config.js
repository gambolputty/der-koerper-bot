import { visualizer } from "rollup-plugin-visualizer";
import esbuild from "rollup-plugin-esbuild";
import { defineConfig } from "rollup";
import { nodeResolve } from "@rollup/plugin-node-resolve";
import packageJson from "./package.json" assert { type: "json" };
import copy from "rollup-plugin-copy";

const outputOptions = {
  name: packageJson.name,
  exports: "named",
  sourcemap: true,
};

export default defineConfig({
  external: ["fs", "path"],
  input: "lib/index.ts",
  output: [
    {
      ...outputOptions,
      format: "es",
      file: packageJson.module,
    },
    // {
    //   ...outputOptions,
    //   format: "umd",
    //   file: packageJson.main,
    // },
  ],
  plugins: [
    esbuild({
      minify: true,
      target: "esnext",
    }),
    copy({
      targets: [{ src: "lib/assets/sentences.csv", dest: "dist" }],
    }),
    nodeResolve(),
    visualizer({
      emitFile: true,
      sourcemap: true,
      gzipSize: true,
    }),
  ],
});
