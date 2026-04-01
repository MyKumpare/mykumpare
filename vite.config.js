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
  },
}));
