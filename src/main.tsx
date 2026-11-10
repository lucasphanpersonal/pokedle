import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource/press-start-2p/latin-400.css'
import './index.css'
import App from './App.tsx'
import { applyBigText, applyCrt, isBigText, isCrtOn } from './lib/display'

applyCrt(isCrtOn())
applyBigText(isBigText())

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
