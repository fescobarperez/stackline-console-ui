// Avisos breves (toasts). Un solo proveedor para toda la consola:
//   const toast = useToast();  toast('Empresa creada', 'success');
// Tipos: '' (neutro), 'success', 'danger'.
import React, { createContext, useCallback, useContext, useState } from 'react';
import Icon from './Icon.jsx';

const ToastContext = createContext(() => {});

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const push = useCallback((msg, kind = '') => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, msg, kind }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3600);
  }, []);
  return (
    <ToastContext.Provider value={push}>
      {children}
      <div className="toast-stack" role="status" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`toast ${t.kind}`}>
            {t.kind === 'success' && <Icon name="check" size={16} />}
            {t.kind === 'danger' && <Icon name="alert" size={16} />}
            {t.msg}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);
