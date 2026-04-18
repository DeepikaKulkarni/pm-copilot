import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './styles/index.css'

// StrictMode double-invokes effects in development to surface side-effect bugs.
// Mermaid rendering uses random IDs per render to avoid duplicate-ID collisions.
ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
