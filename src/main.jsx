import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import './i18n/index.js';
import Root from './Root.jsx';
import { ConfirmProvider } from './components/ConfirmDialog.jsx';
import { ToastProvider } from './components/Toast.jsx';
import './styles/global.css';
import './styles/console.css';

// La consola se publica bajo una ruta (/console): el router antepone esa base
// a /empresas, /login, etc. Viene de vite.config.js (base).
const BASE = import.meta.env.BASE_URL.replace(/\/+$/, '') || '/';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter basename={BASE}>
      <ConfirmProvider>
        <ToastProvider>
          <Root />
        </ToastProvider>
      </ConfirmProvider>
    </BrowserRouter>
  </React.StrictMode>,
);
