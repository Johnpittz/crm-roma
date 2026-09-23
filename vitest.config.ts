import { defineConfig } from 'vitest/config'

export default defineConfig({
  // Next mantém "jsx": "preserve" no tsconfig; nos testes precisamos do transform automático
  oxc: {
    jsx: {
      runtime: 'automatic',
    },
  },
  test: {
    environment: 'node',
  },
})
