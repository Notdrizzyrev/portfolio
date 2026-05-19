import { useState, useEffect } from 'react'
import './App.css'

const BACKEND_URL = import.meta.env.VITE_PYTHON_API || 'http://localhost:5000'

export default function App() {
  const [status, setStatus] = useState('loading')
  const [message, setMessage] = useState('')
  const [backendUrl, setBackendUrl] = useState(BACKEND_URL)

  useEffect(() => {
    checkBackendHealth()
  }, [])

  const checkBackendHealth = async () => {
    try {
      const response = await fetch(`${BACKEND_URL}/health`)
      const data = await response.json()
      setStatus('success')
      setMessage(data.status || 'Connected to backend!')
    } catch (error) {
      setStatus('error')
      setMessage(`Cannot connect to backend: ${error.message}`)
    }
  }

  return (
    <div className="app">
      <div className="container">
        <div className="logo">🎌</div>
        <h1>AniVault</h1>
        <p className="subtitle">Anime Streaming Platform</p>

        <div className={`status-card ${status}`}>
          <div className="status-icon">
            {status === 'loading' && '⏳'}
            {status === 'success' && '✅'}
            {status === 'error' && '❌'}
          </div>
          <div className="status-content">
            <h2>Backend Status</h2>
            <p>{message}</p>
            <p className="url">Backend: {backendUrl}</p>
          </div>
        </div>

        <div className="features">
          <h3>Features Coming Soon:</h3>
          <ul>
            <li>🎬 Browse Anime</li>
            <li>⭐ Watchlist</li>
            <li>📊 Progress Tracking</li>
            <li>⚙️ User Settings</li>
            <li>🔔 Notifications</li>
          </ul>
        </div>

        <button onClick={checkBackendHealth} className="btn">
          Check Backend Again
        </button>
      </div>
    </div>
  )
}