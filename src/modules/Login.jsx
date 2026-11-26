// Login del operador de plataforma. Mismo diseño que el de maya-ui, sin código
// de empresa: los operadores no pertenecen a ninguna.
import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import Logo from '../components/Logo.jsx';
import Icon from '../components/Icon.jsx';
import { login } from '../api/platform.js';
import { isValidEmail } from '../lib/companyStatus.js';

export default function Login({ onLogin }) {
  const { t } = useTranslation();
  const [form, setForm] = useState({ email: '', password: '' });
  const [errors, setErrors] = useState({});
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loginError, setLoginError] = useState('');
  const emailRef = useRef(null);

  useEffect(() => { emailRef.current?.focus(); }, []);

  const set = (k, v) => {
    setForm((f) => ({ ...f, [k]: v }));
    if (errors[k]) setErrors((e) => ({ ...e, [k]: '' }));
    if (loginError) setLoginError('');
  };

  const submit = async (e) => {
    e.preventDefault();
    const errs = {};
    if (!form.email.trim()) errs.email = t('login.errors.emailRequired', 'Ingresa tu correo');
    else if (!isValidEmail(form.email)) errs.email = t('login.errors.emailInvalid', 'Correo inválido');
    if (!form.password) errs.password = t('login.errors.passwordRequired', 'Ingresa tu contraseña');
    if (Object.keys(errs).length) { setErrors(errs); return; }
    setLoading(true);
    try {
      onLogin(await login(form.email.trim(), form.password));
    } catch (err) {
      setLoginError(err.status === 401
        ? t('login.errors.invalid', 'Correo o contraseña incorrectos.')
        : err.message);
      setLoading(false);
    }
  };

  const features = [
    [t('login.f1', 'Empresas cliente'), t('login.f1d', 'Alta guiada, estados y administradores')],
    [t('login.f2', 'Planes y módulos'), t('login.f2d', 'Qué usa cada empresa y con qué límites')],
    [t('login.f3', 'Agentes de IA'), t('login.f3d', 'Modelos, playbooks y canales por empresa')],
    [t('login.f4', 'Uso y costos'), t('login.f4d', 'Consumo y margen por cliente')],
  ];

  return (
    <div className="login-root">
      <div className="login-brand">
        <div className="login-brand-inner">
          <div className="login-logo">
            <Logo size={36} className="login-mark" />
            <div>
              <div className="login-logo-name">Stackline</div>
              <div className="login-logo-tier">{t('shell.tier', 'CONSOLA DE PLATAFORMA')}</div>
            </div>
          </div>
          <div className="login-headline">
            {t('login.headline1', 'Gestión de la plataforma')}<br />{t('login.headline2', 'y de sus empresas')}
          </div>
          <div className="login-subheadline">{t('login.sub', 'Solo para el equipo de Stackline')}</div>
          <ul className="login-features">
            {features.map(([title, desc]) => (
              <li key={title} className="login-feature-item">
                <span className="login-feature-dot" />
                <span>
                  <strong>{title}</strong>
                  <span className="login-feature-desc"><span className="login-feature-sep"> · </span>{desc}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
        <div className="login-brand-footer">
          <span className="login-brand-legal">© 2026 Stackline · Guatemala</span>
        </div>
      </div>

      <div className="login-form-panel">
        <div className="login-card">
          <div className="login-card-head">
            <h1 className="login-title">{t('login.title', 'Consola de plataforma')}</h1>
            <p className="login-desc">{t('login.desc', 'Ingresa con tu cuenta de operador.')}</p>
          </div>

          <form className="login-form" onSubmit={submit} noValidate>
            <div className={`login-field ${errors.email ? 'has-error' : ''}`}>
              <label htmlFor="email" className="login-label">{t('login.email', 'Correo electrónico')}</label>
              <div className="login-input-wrap">
                <span className="login-input-icon"><Icon name="mail" size={16} /></span>
                <input ref={emailRef} id="email" type="email" className="login-input"
                  placeholder="operador@stackline.gt" value={form.email}
                  onChange={(e) => set('email', e.target.value)} autoComplete="username" />
              </div>
              {errors.email && <span className="login-error">{errors.email}</span>}
            </div>

            <div className={`login-field ${errors.password ? 'has-error' : ''}`}>
              <label htmlFor="password" className="login-label">{t('login.password', 'Contraseña')}</label>
              <div className="login-input-wrap">
                <span className="login-input-icon"><Icon name="lock" size={16} /></span>
                <input id="password" type={showPass ? 'text' : 'password'} className="login-input"
                  placeholder="••••••••" value={form.password}
                  onChange={(e) => set('password', e.target.value)} autoComplete="current-password" />
                <button type="button" className="login-eye" onClick={() => setShowPass((s) => !s)} tabIndex={-1}
                  aria-label={showPass ? t('login.hide', 'Ocultar contraseña') : t('login.show', 'Mostrar contraseña')}>
                  <Icon name={showPass ? 'eyeOff' : 'eye'} size={16} />
                </button>
              </div>
              {errors.password && <span className="login-error">{errors.password}</span>}
            </div>

            {loginError && <div className="login-alert" role="alert">{loginError}</div>}

            <button type="submit" className="login-submit" disabled={loading}>
              {loading ? <><span className="login-spinner" />{t('login.submitting', 'Ingresando…')}</> : t('login.submit', 'Ingresar')}
            </button>
          </form>
        </div>
      </div>

      <div className="login-page-legal">© 2026 Stackline · Guatemala</div>
    </div>
  );
}
