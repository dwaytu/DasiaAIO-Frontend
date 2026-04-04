import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const devPort = parseInt(process.env.PORT || '5173')

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
    port: devPort,
    host: '0.0.0.0',
    strictPort: true,
    hmr: {
      host: process.env.VITE_HMR_HOST || 'localhost',
      clientPort: devPort,
      protocol: 'ws',
    },
  },
})
