import typescript from "@rollup/plugin-typescript";
import terser from "@rollup/plugin-terser";
import { nodeResolve } from "@rollup/plugin-node-resolve";
import commonjs from "@rollup/plugin-commonjs";
import json from "@rollup/plugin-json";

export default {
  input: "src/index.ts",
  output: [
    {
      dir: "out",
      format: "esm",
      entryFileNames: "[name].mjs",
    },
    {
      dir: "out",
      format: "cjs",
      entryFileNames: "[name].cjs",
    },
  ],
  treeshake: "recommended",
  external: ["ssh2"],
  plugins: [
    json(),
    nodeResolve({
      preferBuiltins: false,
    }),
    commonjs(),
    typescript({
      declaration: true,
      outDir: "out",
      emitDecoratorMetadata: true,
      experimentalDecorators: true,
    }),
    terser({
      format: {
        comments: "some",
        beautify: true,
        ecma: "2022",
      },
      compress: false,
      mangle: false,
      module: true,
    }),
  ],
};
