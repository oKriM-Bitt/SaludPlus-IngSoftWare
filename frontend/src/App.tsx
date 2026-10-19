import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { TotemPage } from './features/totem/TotemPage';
import { ProfesionalPage } from './features/profesional/ProfesionalPage';
import { SecretariaPage } from './features/secretaria/SecretariaPage';
import { ComponentesPage } from './features/componentes/ComponentesPage';

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/totem" element={<TotemPage />} />
        <Route path="/profesional" element={<ProfesionalPage />} />
        <Route path="/secretaria" element={<SecretariaPage />} />
        <Route path="/componentes" element={<ComponentesPage />} />
        {/* Próxima pantalla: /sala */}
        <Route path="*" element={<Navigate to="/totem" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
