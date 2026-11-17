import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    coverage: {
      provider: 'istanbul',
      reporter: ['text', 'lcov'],
      exclude: [
        'node_modules/**',
        'dist/**',
        'e2e/**',
        '**/*.d.ts',
        '**/*.config.*',
        'src/__tests__/**',
      ],
    },
  },
})

