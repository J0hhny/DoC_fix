import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './DemoApp.jsx' // Branch demo: Demo-Version; volle Version: ./App.jsx
import Zugang from './Zugang.jsx'
import './stil.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <Zugang>
      <App />
    </Zugang>
  </React.StrictMode>,
)
