/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  // Served as a GitHub Pages project page at
  // https://nguillet23.github.io/HOA/ (repo name, not a custom domain) —
  // asset URLs need this prefix or they'll 404 under that subpath.
  base: '/HOA/',
  plugins: [react()],
  test: {
    environment: 'node',
    // Default 5s is too tight for zipOutput.test.ts, which zips a ~1MB
    // real macro workbook with compression on every case.
    testTimeout: 20000,
  },
})
