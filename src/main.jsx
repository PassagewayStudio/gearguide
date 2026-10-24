import React from 'react'
import ReactDOM from 'react-dom/client'
import App from '@/App.jsx'
import ChatWidget from '@/components/ChatWidget.jsx'
import '@/index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <>
    <App />
    <ChatWidget />
  </>
)
