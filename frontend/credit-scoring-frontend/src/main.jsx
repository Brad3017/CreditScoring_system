import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
// Self-hosted fonts: Latin subset, only the weights tokens.css uses (font-display: swap).
import "@fontsource/instrument-sans/latin-400.css";
import "@fontsource/instrument-sans/latin-500.css";
import "@fontsource/instrument-sans/latin-600.css";
import "@fontsource/instrument-sans/latin-700.css";
import "@fontsource/newsreader/latin-500.css";
import "@fontsource/newsreader/latin-600.css";
import "./styles/tokens.css";

// The A / A+ / A++ text-size control was removed; the size is now fixed in tokens.css.
// Clear the old saved choice so nobody keeps a stale setting.
try {
  localStorage.removeItem("bs-text-size");
} catch {
  // Storage blocked (private mode): nothing was saved, nothing to clear.
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
