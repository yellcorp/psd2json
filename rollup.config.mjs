import typescript from "@rollup/plugin-typescript";
import { resolve } from "node:path";

const createConfig = (cliArgs) => {
  const hostConfig = {
    input: resolve("host", "src", "hostmain.ts"),
    output: {
      name: "hostmain",
      file: resolve(
        "dist",
        "debug",
        "org.yellcorp.psd2json",
        "host",
        "hostmain.jsx",
      ),
      format: "iife",
      sourcemap: true,
    },
    plugins: [
      typescript({
        tsconfig: resolve("host", "tsconfig.json"),
      }),

      // Not using nodeResolve - the likelihood of any given npm package
      // being usable in ExtendScript is extremely low.
    ],
  };

  return [hostConfig];
};

export default createConfig;
