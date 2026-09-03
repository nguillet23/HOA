/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'node',
    // Default 5s is too tight for zipOutput.test.ts, which zips a ~1MB
    // real macro workbook with compression on every case.
    testTimeout: 20000,
  },
})
