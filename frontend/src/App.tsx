import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { TotemPage } from './features/totem/TotemPage';
import { ProfesionalPage } from './features/profesional/ProfesionalPage';

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/totem" element={<TotemPage />} />
        <Route path="/profesional" element={<ProfesionalPage />} />
        {/* Próximas pantallas: /secretaria y /sala */}
        <Route path="*" element={<Navigate to="/totem" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
