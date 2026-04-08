import * as Sentry from "@sentry/react"

import React from 'react'
import ReactDOM from 'react-dom/client'
import './index.css'
import App from './App'
import './i18n'

Sentry.init({
  dsn: "https://e0e1fb9f10da17e15805863260f4de91@o4511186096881664.ingest.us.sentry.io/4511186115624960",
  integrations: [
    Sentry.browserTracingIntegration(),
    Sentry.replayIntegration(),
  ],
  tracesSampleRate: 1.0,
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,
  environment: process.env.NODE_ENV || 'development',
  enabled: process.env.NODE_ENV === 'production',
})

const root = ReactDOM.createRoot(document.getElementById('root'))
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
