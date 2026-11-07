/// <reference types="vitest/config" />
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// `base: './'` keeps asset paths relative, so the same build works at a
// domain root (Vercel, Netlify) or under a sub-path (GitHub Pages /pokemondle/).
export default defineConfig({
  base: './',
  plugins: [react(), tailwindcss()],
  test: {
    environment: 'node',
  },
})
