/// <reference types="vitest/config" />
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { execSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { defineConfig } from 'vite'

/** Git short SHA, else the package.json version, else 'dev'. */
function appVersion(): string {
  try {
    const sha = execSync('git rev-parse --short HEAD', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim()
    if (sha) return sha
  } catch {
    // not a git checkout
  }
  try {
    const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'))
    if (typeof pkg.version === 'string' && pkg.version) return pkg.version
  } catch {
    // ignore
  }
  return 'dev'
}

// `base: './'` keeps asset paths relative, so the same build works at a
// domain root (Vercel, Netlify) or under a sub-path (GitHub Pages /pokemondle/).
export default defineConfig({
  base: './',
  define: { __APP_VERSION__: JSON.stringify(appVersion()) },
  plugins: [react(), tailwindcss()],
  test: {
    environment: 'node',
  },
})
