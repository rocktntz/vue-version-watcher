import { defineConfig } from "rollup";
import typescript from "@rollup/plugin-typescript";
import { nodeResolve } from "@rollup/plugin-node-resolve";
import commonjs from "@rollup/plugin-commonjs";
import terser from '@rollup/plugin-terser';

export default defineConfig({
  input: "src/index.ts",
  output: [
    {
      file: "dist/index.js",
      format: "cjs",
      exports: "named",
    },
    {
      file: "dist/index.esm.js",
      format: "esm",
    },
    {
      file: "dist/index.umd.js",
      format: "umd",
      name: "VueVersionWatcher",
    },
  ],
  plugins: [
    nodeResolve({
      browser: true,
    }),
    commonjs(),
    typescript(),
    terser(),
  ],
  external: ["vue"],
});
