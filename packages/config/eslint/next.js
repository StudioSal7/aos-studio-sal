import { FlatCompat } from '@eslint/eslintrc';
import { baseConfig } from './base.js';

const compat = new FlatCompat();

// next/typescript (via FlatCompat) registra seu próprio objeto de plugin
// "@typescript-eslint", que colide com o já registrado por tseslint.configs.recommended
// no baseConfig (mesmo pacote, instância de módulo diferente) — o flat config do ESLint
// rejeita dois objetos de plugin distintos sob a mesma chave ("Cannot redefine plugin").
// Mantemos as regras de next/typescript, só removendo o registro duplicado do plugin.
const nextCompatConfigs = compat.extends('next/core-web-vitals', 'next/typescript').map((config) => {
  if (!config.plugins?.['@typescript-eslint']) return config;
  const { '@typescript-eslint': _dropped, ...restPlugins } = config.plugins;
  return { ...config, plugins: restPlugins };
});

/** @type {import("eslint").Linter.Config[]} */
export const nextConfig = [...baseConfig, ...nextCompatConfigs];

export default nextConfig;
