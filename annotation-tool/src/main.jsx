import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

// 将 stores 暴露到 window 以便调试
import { useVideoStore } from './stores/videoStore'
import { useAnnotationStore } from './stores/annotationStore'
import { useSessionStore } from './stores/sessionStore'
import { useUIStore } from './stores/uiStore'

if (typeof window !== 'undefined') {
  window.stores = {
    video: useVideoStore,
    annotation: useAnnotationStore,
    session: useSessionStore,
    ui: useUIStore,
  }
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
