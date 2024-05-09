import { nodeResolve } from "@rollup/plugin-node-resolve";
import { defineConfig } from "rollup";
import copy from "rollup-plugin-copy";
import esbuild from "rollup-plugin-esbuild";
import { visualizer } from "rollup-plugin-visualizer";

import packageJson from "./package.json" assert { type: "json" };

const outputOptions = {
  name: packageJson.name,
  exports: "named",
  sourcemap: true,
};

export default defineConfig({
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
  external: [
    "node:util",
    "node:buffer",
    "node:stream",
    "node:net",
    "node:url",
    "node:fs",
    "node:path",
  ],
  plugins: [
    esbuild({
      minify: true,
      target: "esnext",
    }),
    copy({
      targets: [
        { src: "lib/assets/sentences.csv", dest: "dist" },
        { src: "lib/assets/frequencies.json", dest: "dist" },
      ],
    }),
    nodeResolve(),
    visualizer({
      emitFile: true,
      sourcemap: true,
      gzipSize: true,
    }),
  ],
});
