// Rutas y sesión del operador.
import React, { useEffect, useState } from 'react';
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import Shell from './Shell.jsx';
import Login from './modules/Login.jsx';
import Companies from './modules/Companies.jsx';
import CompanyCreate from './modules/CompanyCreate.jsx';
import CompanyDetail from './modules/CompanyDetail.jsx';
import Plans from './modules/Plans.jsx';
import Usage from './modules/Usage.jsx';
import Ai from './modules/Ai.jsx';
import { loadSession, onUnauthorized } from './api/client.js';
import { logout } from './api/platform.js';
import { IA_MODELOS, USO } from './lib/features.js';

export default function Root() {
  const [session, setSession] = useState(loadSession);
  const navigate = useNavigate();

  // Token vencido en cualquier llamada: de vuelta al login.
  useEffect(() => onUnauthorized(() => { setSession(null); navigate('/login', { replace: true }); }), [navigate]);

  const salir = () => { logout(); setSession(null); navigate('/login', { replace: true }); };

  if (!session) {
    return (
      <Routes>
        <Route path="/login" element={<Login onLogin={(s) => { setSession(s); navigate('/empresas', { replace: true }); }} />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }

  return (
    <Routes>
      <Route element={<Shell session={session} onLogout={salir} />}>
        <Route path="/empresas" element={<Companies session={session} />} />
        <Route path="/empresas/nueva" element={<CompanyCreate session={session} />} />
        <Route path="/empresas/:id" element={<CompanyDetail session={session} />} />
        <Route path="/planes" element={<Plans session={session} />} />
        {USO && <Route path="/uso" element={<Usage session={session} />} />}
        {IA_MODELOS && <Route path="/ia" element={<Ai session={session} />} />}
      </Route>
      <Route path="*" element={<Navigate to="/empresas" replace />} />
    </Routes>
  );
}
