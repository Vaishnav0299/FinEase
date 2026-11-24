import js from '@eslint/js'
import react from 'eslint-plugin-react'
import globals from 'globals'

export default [
  { ignores: ['dist/**', '.wrangler/**', '.tanstack/**', 'src/routeTree.gen.ts'] },
  {
    files: ['**/*.{js,jsx}'],
    ...js.configs.recommended,
    languageOptions: {
      ecmaVersion: 'latest', sourceType: 'module',
      globals: { ...globals.browser, ...globals.node },
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    plugins: { react },
    rules: { ...js.configs.recommended.rules, 'react/jsx-uses-vars': 'error', 'react/jsx-no-undef': 'error' },
  },
]
