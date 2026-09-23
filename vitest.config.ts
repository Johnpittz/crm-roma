import { defineConfig } from 'vitest/config'
import { fileURLToPath } from 'node:url'

export default defineConfig({
  // Alias "@/" do Next — permite testar componentes que importam "@/components/..."
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./', import.meta.url)),
    },
  },
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
