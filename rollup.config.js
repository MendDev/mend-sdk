import typescript from '@rollup/plugin-typescript';
import { terser } from 'rollup-plugin-terser';

export default {
  input: 'src/index.ts',
  plugins: [typescript()],
  output: [
    {
      file: 'dist/sdk.esm.js',
      format: 'es',
    },
    {
      file: 'dist/sdk.cjs.js',
      format: 'cjs',
    },
    {
      file: 'dist/sdk.umd.js',
      format: 'umd',
      name: 'MendSdk',
      plugins: [terser()],
    },
  ],
};
