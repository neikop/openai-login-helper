import { createRoot } from 'react-dom/client';
import { App } from './App';
import './styles.css';

// Action popups size their viewport from content, so use the available screen
// height instead of a circular vh-based height. Chromium caps popups at 600px.
document.documentElement.style.setProperty('--popup-height', `${Math.max(240, window.screen.availHeight - 160)}px`);
createRoot(document.getElementById('root')!).render(<App />);
