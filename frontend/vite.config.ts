import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true,
      }
    }
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          // Core React framework
          'vendor-react': ['react', 'react-dom'],
          // Editor framework
          'vendor-tiptap': [
            '@tiptap/core',
            '@tiptap/react',
            '@tiptap/starter-kit',
          ],
          // Heavy dependencies - lazy loaded
          'vendor-pdf': ['pdfjs-dist'],
          'vendor-xlsx': ['xlsx'],
          'vendor-pptx': ['pptxgenjs'],
          'vendor-mermaid': ['mermaid'],
          'vendor-math': ['mathjs', 'katex'],
          // App modules
          'app-sheets': [
            './src/sheets/SpreadsheetEditor.tsx',
            './src/sheets/sheetModel.ts',
            './src/sheets/formulaEngine.ts',
            './src/sheets/conditionalEval.ts',
            './src/sheets/cellFormat.ts',
            './src/sheets/fillLogic.ts',
            './src/sheets/pivotEngine.ts',
            './src/sheets/chartRenderer.ts',
          ],
          'app-slides': [
            './src/slides/SlidesEditor.tsx',
            './src/slides/slideModel.ts',
            './src/slides/slideLayouts.ts',
            './src/slides/slideThemes.ts',
            './src/slides/slideIO.ts',
          ],
          'app-draw': [
            './src/draw/DrawingEditor.tsx',
          ],
        },
      },
    },
    chunkSizeWarningLimit: 600,
  },
})
