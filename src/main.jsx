import { createRoot } from 'react-dom/client'
import '@fontsource-variable/fraunces'
import '@fontsource-variable/inter'
import './styles.css'
import App from './App.jsx'
import { startSmoothScroll } from './lib/motion.js'

startSmoothScroll()
createRoot(document.getElementById('root')).render(<App />)
