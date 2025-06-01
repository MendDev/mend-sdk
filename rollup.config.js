import typescript from '@rollup/plugin-typescript';
import { terser } from 'rollup-plugin-terser';
import filesize from 'rollup-plugin-filesize';

export default {
  input: 'src/index.ts',
  plugins: [typescript(), filesize()],
  output: [
    {
      file: 'dist/sdk.esm.js',
      format: 'es',
      plugins: [terser()]
    },
    {
      file: 'dist/sdk.cjs.js',
      format: 'cjs',
      plugins: [terser()]
    },
    {
      file: 'dist/sdk.umd.js',
      format: 'umd',
      name: 'MendSdk',
      plugins: [terser()]
    },
  ],
};
