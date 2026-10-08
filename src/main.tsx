import { createRoot } from 'react-dom/client'
import './classical.css'
import './app.css'
import App from './App'
import Staff from './staff/Staff'
import { registerPwa } from './pwa'

const isStaff = () => location.hash.replace(/^#\/?/, '').startsWith('staff')
const root = createRoot(document.getElementById('root')!)
const draw = () => root.render(isStaff() ? <Staff /> : <App />)
draw()
window.addEventListener('hashchange', () => { if (isStaff() !== lastStaff) { lastStaff = isStaff(); draw() } })
let lastStaff = isStaff()
registerPwa(isStaff())
