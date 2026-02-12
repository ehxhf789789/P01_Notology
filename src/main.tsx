import { createRoot } from 'react-dom/client'
import { getCurrentWindow } from '@tauri-apps/api/window'
import './index.css'
import 'tippy.js/dist/tippy.css'
// Initialize editor pool early for fast hover window opening
import './utils/editorPool'
import App from './App.tsx'
import HoverWindowApp from './HoverWindowApp.tsx'

// Detect if we're in a hover window based on window label
async function initializeApp() {
  const windowLabel = getCurrentWindow().label;
  const isHoverWindow = windowLabel.startsWith('hover-');

  const root = createRoot(document.getElementById('root')!);

  // Render appropriate app based on window type
  if (isHoverWindow) {
    root.render(<HoverWindowApp />);
  } else {
    // Note: StrictMode removed for performance
    // StrictMode causes double-mounting in dev mode, which:
    // - Acquires/releases editors twice
    // - Triggers file loading twice
    // - Doubles all useEffect executions
    // Production builds don't use StrictMode anyway
    root.render(<App />);
  }
}

initializeApp();
