import nextCoreWebVitals from 'eslint-config-next/core-web-vitals';
import nextTypescript from 'eslint-config-next/typescript';

const eslintConfig = [
  {
    ignores: ['.next/**', 'next-env.d.ts', 'node_modules/**', 'out/**']
  },
  ...nextCoreWebVitals,
  ...nextTypescript
];

export default eslintConfig;
