import React from 'react'
import ReactDOM from 'react-dom/client'
import posthog from 'posthog-js'
import { PostHogProvider } from 'posthog-js/react'
import App from '@/App.jsx'
import ChatWidget from '@/components/ChatWidget.jsx'
import '@/index.css'

posthog.init(import.meta.env.VITE_POSTHOG_KEY, {
  api_host: '/ingest',
  ui_host: 'https://us.posthog.com',
  defaults: '2025-05-24',
  person_profiles: 'identified_only',
})

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <PostHogProvider client={posthog}>
      <App />
      <ChatWidget />
    </PostHogProvider>
  </React.StrictMode>
)
