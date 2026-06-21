import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    // Raise warning threshold — react-pdf is intentionally large
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        manualChunks: {
          // React core — cached forever after first load
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          // Firebase SDK — large but infrequently changes
          'vendor-firebase': ['firebase/app', 'firebase/auth', 'firebase/firestore', 'firebase/storage'],
          // Animation — Framer Motion is sizeable
          'vendor-motion': ['framer-motion'],
          // PDF generation — always lazy since most users never print
          'vendor-pdf': ['@react-pdf/renderer'],
          // UI utilities
          'vendor-ui': ['lucide-react', 'clsx', 'tailwind-merge', 'class-variance-authority'],
        },
      },
    },
  },
})
