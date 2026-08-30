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
      legacySDKImports: true,
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
      // Pin React/ReactDOM to the installed copies — prevents Vite dep cache
      // corruption from serving a null React module.
      react: path.resolve(__dirname, 'node_modules/react'),
      'react-dom': path.resolve(__dirname, 'node_modules/react-dom'),
    },
    // Force a single copy of React/ReactDOM — prevents the
    // "Cannot read properties of null (reading 'useState')" runtime error
    // caused by duplicate React copies in the Vite dep cache.
    dedupe: ['react', 'react-dom'],
  },
  optimizeDeps: {
    // Force re-optimization on every server start — clears stale/corrupted
    // dep chunks that cause the null React module error.
    force: true,
  },
}));