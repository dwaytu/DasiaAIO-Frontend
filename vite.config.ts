import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'app-dist',
    emptyOutDir: true,
    rollupOptions: {
      output: {
        manualChunks: {
          mapping: ['leaflet', 'react-leaflet'],
          icons: ['lucide-react'],
        },
      },
    },
  },
  preview: {
    port: parseInt(process.env.PORT || '4173'),
    host: '0.0.0.0',
  },
  server: {
    port: parseInt(process.env.PORT || '5173'),
    host: '0.0.0.0',
  }
})
