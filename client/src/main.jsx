import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import '@fontsource-variable/sora';
import '@fontsource-variable/inter';
import '@fontsource-variable/fraunces/wght-italic.css';
import './styles.css';
import './landing.css';

createRoot(document.getElementById('root')).render(<App />);
