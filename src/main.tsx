import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'
import 'leaflet/dist/leaflet.css'
import { ThemeProvider } from './context/ThemeProvider'
import { applyPlatformDomAttributes } from './utils/platform'
import { disableServiceWorkerInDevelopment } from './utils/pushNotifications'

applyPlatformDomAttributes()

async function bootstrap() {
  await disableServiceWorkerInDevelopment()

  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <ThemeProvider>
        <App />
      </ThemeProvider>
    </React.StrictMode>,
  )
}

void bootstrap()
