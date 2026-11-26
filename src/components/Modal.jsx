// Modal base (markup .modal de global.css): se cierra con Escape o tocando
// fuera, y devuelve el foco a quien lo abrió.
import React, { useEffect, useRef } from 'react';
import Icon from './Icon.jsx';

export default function Modal({ title, onClose, children, footer, size = 'modal-sm', busy = false }) {
  const ref = useRef(null);
  useEffect(() => {
    const previo = document.activeElement;
    const esc = (e) => { if (e.key === 'Escape' && !busy) onClose(); };
    window.addEventListener('keydown', esc);
    ref.current?.querySelector('input, select, textarea, button:not(.modal-close)')?.focus();
    return () => { window.removeEventListener('keydown', esc); previo?.focus?.(); };
  }, [onClose, busy]);
  return (
    <div className="modal-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget && !busy) onClose(); }}>
      <div className={`modal ${size}`} role="dialog" aria-modal="true" aria-label={title} ref={ref}>
        <div className="modal-head">
          <h3>{title}</h3>
          <button type="button" className="icon-btn modal-close" aria-label="Cerrar" onClick={onClose} disabled={busy}>
            <Icon name="close" size={20} />
          </button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>
  );
}
