import { createRoot } from 'react-dom/client'
import './index.css'
import 'tippy.js/dist/tippy.css'
// Initialize editor pool early for fast hover window opening
import './utils/editorPool'
import App from './App.tsx'

// Note: StrictMode removed for performance
// StrictMode causes double-mounting in dev mode, which:
// - Acquires/releases editors twice
// - Triggers file loading twice
// - Doubles all useEffect executions
// Production builds don't use StrictMode anyway
createRoot(document.getElementById('root')!).render(<App />)
