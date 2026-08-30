import base44 from "@base44/vite-plugin"
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import path from 'path'

// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
  // When deploying to GitHub Pages the app lives under /<repo-name>/.
  // Set VITE_BASE_PATH=/mykumpare/ in CI; leave unset for local dev (defaults to /).
  base: process.env.VITE_BASE_PATH || '/',
  plugins: [
    // base44 plugin makes external network calls during build that break
    // production builds on Netlify/GitHub Pages — use it only in dev mode
    ...(mode === 'development' ? [base44({
      legacySDKImports: process.env.BASE44_LEGACY_SDK_IMPORTS === 'true',
      hmrNotifier: true,
      navigationNotifier: true,
      analyticsTracker: true,
      visualEditAgent: true,
    })] : []),
    react(),
  ],
  resolve: {
    alias: {
      // Explicit '@' alias — mirrors jsconfig.json for production builds
      '@': path.resolve(__dirname, './src'),
    },
    // Force a single copy of React/ReactDOM — prevents the
    // "Cannot read properties of null (reading 'useState')" runtime error
    // caused by duplicate React copies in the Vite dep cache.
    dedupe: ['react', 'react-dom'],
  },
  optimizeDeps: {
    // Force re-optimization to clear stale browser hash from server memory
    force: true,
    // Pre-bundle all React entries so Vite doesn't discover react/jsx-dev-runtime
    // mid-load, re-optimize, and mint mismatched chunks (react.js?v=A vs react.js?v=B)
    // that cause "Cannot read properties of null (reading 'useState')".
    // This mirrors @base44/vite-plugin's PREBUNDLED_SANDBOX_DEPS, which is only
    // applied inside the Modal sandbox — we need it in local dev too.
    include: [
      'react',
      'react/jsx-runtime',
      'react/jsx-dev-runtime',
      'react-dom',
      'react-dom/client',
      'react-router-dom',
      'framer-motion',
      'lodash',
      'moment',
      'react-quill',
    ],
  },
}));