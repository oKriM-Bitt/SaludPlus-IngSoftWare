import { Logo } from '../../components/Logo';
import { Icon, type IconName } from '../../components/Icon';
import { Button } from '../../components/Button';
import { Alerta } from '../../components/Alerta';
import { StatusChip, type EstadoTurno } from '../../components/StatusChip';
import './componentes.css';

/** Lámina 05 · Componentes reutilizables: los mismos componentes que usan las pantallas. */
const colores = [
  ['Primario', '#0A6EBD'],
  ['Azul noche', '#0B2440'],
  ['Acento', '#0D9488'],
  ['Acento oscuro', '#0F766E'],
  ['Fondo', '#F4F8FC'],
  ['Superficie', '#FFFFFF'],
  ['Texto', '#1F2937'],
  ['Texto secundario', '#475569'],
  ['Bordes', '#64748B'],
  ['Éxito', '#166534'],
  ['Alerta', '#92400E'],
  ['Error', '#B91C1C'],
  ['Información', '#1D4EDB'],
];

const estados: EstadoTurno[] = ['en-espera', 'llamado', 'cancelado-tolerancia', 'ausente', 'contraturno'];

const iconos: [IconName, string][] = [
  ['calendar-check', 'Turno existente'],
  ['clock', 'Espera'],
  ['user-check', 'Llegada'],
  ['megaphone', 'Llamado'],
  ['wifi', 'Conexión'],
  ['wifi-off', 'Sin conexión'],
];

export function ComponentesPage() {
  return (
    <div className="comp">
      <header className="comp__header">
        <div>
          <h1>SaludPlus · Componentes reutilizables</h1>
          <p>Admisión y sala de espera · elementos editables para seis centros médicos</p>
        </div>
        <Logo size={40} />
      </header>

      <div className="comp__grid">
        <section className="comp__card comp__card--ancha">
          <h2>Paleta y semántica</h2>
          <div className="comp__paleta">
            {colores.map(([nombre, hex]) => (
              <div key={hex} className="comp__color">
                <span style={{ background: hex }} />
                <strong>{nombre}</strong>
                <small>{hex}</small>
              </div>
            ))}
          </div>
          <p className="comp__nota">Acento: solo texto blanco; usar #0F766E para etiquetas accesibles. Estados: siempre ícono y texto.</p>
        </section>

        <section className="comp__card">
          <h2>Inter · jerarquía</h2>
          <p style={{ font: '700 32px/40px Inter' }}>Título · 32/40 Bold</p>
          <p style={{ font: '600 24px/32px Inter' }}>Sección · 24/32 SemiBold</p>
          <p style={{ font: '600 20px/28px Inter' }}>Subtítulo · 20/28 SemiBold</p>
          <p style={{ font: '400 16px/24px Inter' }}>Texto · 16/24 Regular</p>
          <p style={{ font: '400 14px/20px Inter', color: 'var(--color-text-secondary)' }}>Ayuda · 14/20 Regular</p>
          <p className="comp__nota">Tótem ≥ 24 px · número en pantalla de sala ≥ 160 px</p>
        </section>

        <section className="comp__card comp__card--completa">
          <h2>Botones · controles de al menos 48 px</h2>
          <div className="comp__botones">
            <div>
              <h3>Predeterminado</h3>
              <Button>Registrar llegada</Button>
              <Button variant="secondary">Volver</Button>
            </div>
            <div>
              <h3>Foco</h3>
              <Button className="comp__foco">Registrar llegada</Button>
              <Button variant="secondary" className="comp__foco">
                Volver
              </Button>
            </div>
            <div>
              <h3>Deshabilitado</h3>
              <Button disabled>Registrar llegada</Button>
              <Button variant="secondary" disabled>
                Volver
              </Button>
            </div>
            <div>
              <h3>Procesando</h3>
              <Button loading>Registrando…</Button>
              <Button variant="secondary" loading>
                Procesando…
              </Button>
            </div>
          </div>
        </section>

        <section className="comp__card comp__card--completa">
          <h2>Campos · etiqueta arriba y validación debajo</h2>
          <div className="comp__campos">
            <div className="campo">
              <label htmlFor="c1">DNI o número de afiliado · Predeterminado</label>
              <input id="c1" className="input" defaultValue="28456789" />
            </div>
            <div className="campo">
              <label htmlFor="c2">DNI o número de afiliado · Foco</label>
              <input id="c2" className="input comp__input-foco" defaultValue="28456789" />
            </div>
            <div className="campo">
              <label htmlFor="c3">DNI o número de afiliado · Error</label>
              <input id="c3" className="input input--error" defaultValue="28A45678" aria-invalid="true" aria-describedby="c3-error" />
              <p id="c3-error" className="campo__error">
                <Icon name="x-circle" size={18} /> Ingrese solo números, sin puntos.
              </p>
            </div>
            <div className="campo">
              <label htmlFor="c4">DNI o número de afiliado · Deshabilitado</label>
              <input id="c4" className="input" value="No disponible" disabled readOnly />
            </div>
          </div>
        </section>

        <section className="comp__card">
          <h2>Estados y tarjeta de turno</h2>
          <div className="comp__chips">
            {estados.map((e) => (
              <StatusChip key={e} estado={e} />
            ))}
          </div>
          <div className="result-card comp__tarjeta">
            <div className="result-card__top">
              <span className="result-card__numero">A023</span>
              <StatusChip estado="en-espera" />
            </div>
            <span className="result-card__consultorio">Consultorio 4</span>
          </div>
          <p className="comp__conexion comp__conexion--on">
            <Icon name="wifi" size={20} /> Conectado
          </p>
          <p className="comp__conexion comp__conexion--off">
            <Icon name="wifi-off" size={20} /> Sin conexión – última actualización 10:00
          </p>
        </section>

        <section className="comp__card">
          <h2>Medidas y accesibilidad</h2>
          <p>Espaciado: 4 · 8 · 12 · 16 · 24 · 32 · 48 px</p>
          <div className="comp__radios">
            <span>Control · 8 px</span>
            <span>Tarjeta · 12 px</span>
          </div>
          <p className="comp__nota">
            Desktop: 12 columnas · tablet: 8 columnas · mobile: 4. Foco visible azul noche. Contraste de texto ≥ 4,5:1. Tótem: teclas de
            128 px, botones de 96 px y texto mínimo de 24 px.
          </p>
        </section>

        <section className="comp__card comp__card--completa">
          <h2>Alertas · ícono + texto</h2>
          <div className="comp__alertas">
            <Alerta tono="success" titulo="Llegada registrada">
              Su número es A023.
            </Alerta>
            <Alerta tono="warning" titulo="Demora de 20 minutos">
              Clínica médica · consultorio 4.
            </Alerta>
            <Alerta tono="error" titulo="No se pudo registrar">
              Intente nuevamente o consulte en secretaría.
            </Alerta>
            <Alerta tono="info" titulo="Verifique los datos">
              Confirme el turno antes de registrar la llegada.
            </Alerta>
          </div>
        </section>

        <section className="comp__card comp__card--completa">
          <h2>Fila de cola e íconos de línea</h2>
          <div className="comp__fila">
            <strong>A023</strong>
            <span>Marta R.</span>
            <span>Dra. Lucía Ferrer</span>
            <span>4</span>
            <span>10:00</span>
            <span>5 min</span>
            <StatusChip estado="en-espera" />
          </div>
          <div className="comp__iconos">
            {iconos.map(([n, etiqueta]) => (
              <div key={n}>
                <Icon name={n} size={32} />
                <span>{etiqueta}</span>
              </div>
            ))}
          </div>
        </section>
      </div>

      <p className="comp__pie">Alcance: verificar turnos existentes y registrar llegadas. Sin agendamiento ni recordatorios. Todos los casos son ficticios.</p>
    </div>
  );
}
