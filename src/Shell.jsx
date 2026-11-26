// Marco de la consola: menú lateral, barra superior y el área de contenido.
// Mismo comportamiento responsivo que maya-ui: menú expandido o en riel en
// escritorio, cajón en tablet y teléfono.
import React, { useEffect, useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import Icon from './components/Icon.jsx';
import Logo from './components/Logo.jsx';
import Button from './components/Button.jsx';
import TopbarMoreMenu from './components/TopbarMoreMenu.jsx';
import { useLayout } from './hooks/useLayout.js';
import { sidebarMode } from './lib/breakpoints.js';
import { vigilarTablasApiladas } from './lib/stackLabels.js';
import { useTheme } from './lib/theme.js';
import { IA_MODELOS, USO } from './lib/features.js';

// Lo que viene en las siguientes fases se ve, pero deshabilitado: así el menú
// ya cuenta qué va a tener la consola.
const NAV = [
  { id: 'empresas', icon: 'apartment', label: 'Empresas' },
  { id: 'planes', icon: 'workspace_premium', label: 'Planes y módulos' },
  // Lo que aún no tiene backend se ve, deshabilitado (ver lib/features.js).
  { id: 'ia', icon: 'smart_toy', label: 'Modelos y agentes', soon: !IA_MODELOS },
  { id: 'uso', icon: 'monitoring', label: 'Uso y costos', soon: !USO },
  { id: 'bitacora', icon: 'history', label: 'Bitácora', soon: true },
];

export default function Shell({ session, onLogout }) {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const seccion = location.pathname.split('/')[1] || 'empresas';
  const [theme, toggleTheme] = useTheme();
  const layout = useLayout();
  const compacto = layout !== 'desktop';
  const [collapsed, setCollapsed] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const menu = sidebarMode(layout, { collapsed, drawerOpen });
  const op = session.operator;

  const toggleLang = () => i18n.changeLanguage(i18n.language === 'es' ? 'en' : 'es');
  const alternarMenu = () => (compacto ? setDrawerOpen((v) => !v) : setCollapsed((v) => !v));

  useEffect(() => { setDrawerOpen(false); }, [location.pathname, layout]);
  useEffect(() => {
    if (menu !== 'drawer') return undefined;
    const esc = (e) => { if (e.key === 'Escape') setDrawerOpen(false); };
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, [menu]);
  useEffect(() => vigilarTablasApiladas(document.body), []);

  const roleLabel = {
    owner: t('roles.owner', 'Dueño'),
    support: t('roles.support', 'Soporte'),
    viewer: t('roles.viewer', 'Solo lectura'),
  }[op.role] || op.role;

  return (
    <div className="app" data-layout={layout} data-sidebar={menu}>
      <aside className="sidebar">
        <div className="sidebar-brand">
          {/* En riel el logo es el botón para expandir: la flecha se oculta ahí. */}
          {menu === 'collapsed' ? (
            <button type="button" className="drawer-mark-btn"
              title={t('shell.expandMenu', 'Expandir menú')} aria-label={t('shell.expandMenu', 'Expandir menú')}
              onClick={alternarMenu}>
              <Logo size={40} className="drawer-mark" />
            </button>
          ) : (
            <Logo size={40} className="drawer-mark" />
          )}
          <div className="sidebar-brand-text">
            <div className="drawer-wordmark">Stack<span className="wm-l">line</span></div>
            <div className="tier">{t('shell.tier', 'CONSOLA DE PLATAFORMA')}</div>
          </div>
          <button className="icon-btn sidebar-toggle" style={{ marginLeft: 'auto' }}
            aria-label={menu === 'drawer' ? t('shell.closeMenu', 'Cerrar menú') : t('shell.toggleMenu', 'Contraer menú')}
            onClick={alternarMenu}>
            <Icon name="chevronDown" size={13} style={{ transform: menu === 'collapsed' ? 'rotate(-90deg)' : 'rotate(90deg)', transition: 'transform 0.2s' }} />
          </button>
        </div>

        <nav className="sidebar-nav" aria-label={t('shell.nav', 'Navegación')}>
          {NAV.map((it) => (
            <div key={it.id}
              className={`nav-item ${seccion === it.id ? 'active' : ''} ${it.soon ? 'disabled' : ''}`}
              role="link" tabIndex={it.soon ? -1 : 0} aria-disabled={it.soon || undefined}
              title={it.soon ? t('shell.soon', 'Próximamente') : undefined}
              onClick={it.soon ? undefined : () => navigate(`/${it.id}`)}
              onKeyDown={(e) => { if (!it.soon && e.key === 'Enter') navigate(`/${it.id}`); }}>
              <Icon name={it.icon} size={24} fill={seccion === it.id} className="icon" />
              <span className="nav-item-label">{t(`nav.${it.id}`, it.label)}</span>
              {it.soon && <span className="badge">{t('shell.soonShort', 'Pronto')}</span>}
            </div>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div className="avatar">{op.initials}</div>
          <div className="user-info">
            <div className="nm">{op.name}</div>
            <div className="rl">{roleLabel}</div>
          </div>
          <button className="icon-btn" title={t('common.logout', 'Cerrar sesión')} aria-label={t('common.logout', 'Cerrar sesión')} onClick={onLogout}>
            <Icon name="logout" />
          </button>
        </div>
      </aside>
      {menu === 'drawer' && <div className="sidebar-scrim" onClick={() => setDrawerOpen(false)} aria-hidden="true" />}

      <main className="main">
        <header className="topbar">
          {/* Escritorio y tablet abren el menú desde el propio drawer (logo en el
              riel). En el teléfono el drawer está oculto: este es su único acceso. */}
          {layout === 'phone' && (
            <button className="icon-btn" aria-label={t('shell.openMenu', 'Menú')}
              aria-expanded={drawerOpen} onClick={alternarMenu}>
              <Icon name="menu" size={24} />
            </button>
          )}
          <div className="topbar-spacer" />
          <div className="topbar-actions">
            <Button variant="ghost" className="topbar-lang" title={t('common.language', 'Idioma')} onClick={toggleLang} style={{ minWidth: 44, padding: '0 10px' }}>
              {i18n.language === 'en' ? 'EN' : 'ES'}
            </Button>
            <button className="icon-btn topbar-theme" title={t('common.theme', 'Tema')} aria-label={t('common.theme', 'Tema')} onClick={toggleTheme}>
              <Icon name={theme === 'dark' ? 'light_mode' : 'moon'} size={24} />
            </button>
            <div className="avatar topbar-avatar" title={op.name} style={{ width: 32, height: 32, fontSize: 12, marginLeft: 8 }}>
              {op.initials}
            </div>
            <TopbarMoreMenu
              user={{ name: op.name, initials: op.initials, role: roleLabel }}
              language={i18n.language === 'en' ? 'en' : 'es'}
              theme={theme}
              onToggleLanguage={toggleLang}
              onToggleTheme={toggleTheme}
              onLogout={onLogout}
            />
          </div>
        </header>

        <div className="content" key={seccion}>
          <Outlet />
        </div>
      </main>
    </div>
  );
}
