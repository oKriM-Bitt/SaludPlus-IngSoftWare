import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { TotemPage } from './pantallas/totem/TotemPage';
import { ProfesionalPage } from './pantallas/profesional/ProfesionalPage';
import { SecretariaPage } from './pantallas/secretaria/SecretariaPage';
import { ComponentesPage } from './pantallas/lamina/ComponentesPage';
import { SalaPage } from './pantallas/sala/SalaPage';

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/totem" element={<TotemPage />} />
        <Route path="/profesional" element={<ProfesionalPage />} />
        <Route path="/secretaria" element={<SecretariaPage />} />
        <Route path="/sala" element={<SalaPage />} />
        <Route path="/componentes" element={<ComponentesPage />} />
        <Route path="*" element={<Navigate to="/totem" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
