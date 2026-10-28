import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { TotemPage } from './pantallas/totem/TotemPage';
import { ProfesionalPage } from './pantallas/profesional/ProfesionalPage';
import { SecretariaPage } from './pantallas/secretaria/SecretariaPage';
import { ComponentesPage } from './pantallas/lamina/ComponentesPage';
import { SalaPage } from './pantallas/sala/SalaPage';
import { IngresoPage } from './pantallas/ingreso/IngresoPage';
import { InicioPage } from './pantallas/inicio/InicioPage';
import { RutaProtegida } from './componentes/RutaProtegida';

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Públicas: equipos del centro sin usuario */}
        <Route path="/totem" element={<TotemPage />} />
        <Route path="/sala" element={<SalaPage />} />
        <Route path="/componentes" element={<ComponentesPage />} />
        <Route path="/ingresar" element={<IngresoPage />} />

        {/* Internas: requieren sesión y el rol correspondiente */}
        <Route path="/inicio" element={<RutaProtegida><InicioPage /></RutaProtegida>} />
        <Route path="/secretaria" element={<RutaProtegida><SecretariaPage /></RutaProtegida>} />
        <Route path="/profesional" element={<RutaProtegida><ProfesionalPage /></RutaProtegida>} />

        <Route path="*" element={<Navigate to="/inicio" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
