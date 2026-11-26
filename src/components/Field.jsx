// Campo de formulario con etiqueta, ayuda y error, sobre .field-group.
import React, { useId } from 'react';

export default function Field({ label, error, hint, hintOk = false, span2 = false, children }) {
  const id = useId();
  const child = React.isValidElement(children)
    ? React.cloneElement(children, {
      id: children.props.id || id,
      'aria-invalid': error ? true : undefined,
      'aria-describedby': error || hint ? `${id}-msg` : undefined,
    })
    : children;
  return (
    <div className={['field-group', error && 'has-error', span2 && 'span-2'].filter(Boolean).join(' ')}>
      <label className="field-label" htmlFor={children?.props?.id || id}>{label}</label>
      {child}
      {error
        ? <div className="field-error" id={`${id}-msg`}>{error}</div>
        : hint && <div className={`field-hint ${hintOk ? 'ok' : ''}`} id={`${id}-msg`}>{hint}</div>}
    </div>
  );
}
