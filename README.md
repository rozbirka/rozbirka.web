# React + TypeScript + Vite

## Deployment

Deploy through the **Deploy Rozbirka Web** GitHub Actions workflow. Pushes to
`develop` deploy QA automatically. For a manual run, select the branch,
`environment` (`qa` or `prod`), and `enable_deployment`.

Manual runs also offer `skip_e2e` (default: `false`). Enable it to skip all five
browser E2E projects and authenticated Chromium smoke tests. Static, unit,
contract, integration, build, and artifact checks still run and block deployment
on failure. Push and pull-request runs always run browser tests.

The artifact environment checks also run in GitHub Actions. A QA artifact that
contains the production API origin (or a production artifact containing the QA
origin) is rejected before deployment.

## Tenant feature flags

The cabinet reads `/me/feature-flags` from Core once a minute. Use the shared
`FeatureGate` / `useFeatureFlag` with keys from `FEATURE_FLAGS`; do not fetch
feature-specific capability endpoints in entry buttons. `parts.bulk-import`
controls the import entry points. Flags start off, retain the current tenant's
last snapshot on transient errors, and reset on an authenticated tenant change.
Permissions and subscription entitlements remain separate checks.

Core evaluates rules stored in its own database and rejects disabled operations.
Administrators manage these rules in Management; the customer browser receives
only evaluated booleans. Release the Core endpoint before enabling a
flag; a missing endpoint keeps entry points hidden. Accepted imports and their
history remain available through the import route when new admission is off.

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend updating the configuration to enable type-aware lint rules:

```js
export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...

      // Remove tseslint.configs.recommended and replace with this
      tseslint.configs.recommendedTypeChecked,
      // Alternatively, use this for stricter rules
      tseslint.configs.strictTypeChecked,
      // Optionally, add this for stylistic rules
      tseslint.configs.stylisticTypeChecked,

      // Other configs...
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```

You can also install [eslint-plugin-react-x](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-x) and [eslint-plugin-react-dom](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-dom) for React-specific lint rules:

```js
// eslint.config.js
import reactX from 'eslint-plugin-react-x'
import reactDom from 'eslint-plugin-react-dom'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...
      // Enable lint rules for React
      reactX.configs['recommended-typescript'],
      // Enable lint rules for React DOM
      reactDom.configs.recommended,
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```
