import { useState, type FormEvent } from 'react';
import { Button } from '../../componentes/Button';
import { StatusChip } from '../../componentes/StatusChip';
import { Alerta } from '../../componentes/Alerta';
import { PROFESIONALES, profesionalesDelServicio, type Admision } from '../../servicios/turnos';
import { minutosEntre } from '../../utilidades/fechas';
import { TOLERANCIA_MINUTOS } from '../../servicios/tolerancia';
import { hora } from '../../utilidades/fechas';
import { Modal } from './Modal';

const masMinutos = (iso: string, min: number) => new Date(new Date(iso).getTime() + min * 60_000);

type ContraturnoProps = {
  candidatas: Admision[]; // turnos cancelados por tolerancia sin contraturno
  inicial?: Admision;
  onCerrar: () => void;
  onConfirmar: (cancelada: Admision, profesional: string, motivo: string) => Promise<void>;
};

export function ModalContraturno({ candidatas, inicial, onCerrar, onConfirmar }: ContraturnoProps) {
  const [elegida, setElegida] = useState<Admision | undefined>(inicial ?? candidatas[0]);
  const [profesional, setProfesional] = useState(elegida?.profesional ?? PROFESIONALES[0].nombre);
  const [motivo, setMotivo] = useState('Llegada fuera de tolerancia');
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const confirmar = async (e: FormEvent) => {
    e.preventDefault();
    if (!elegida) return;
    if (!motivo.trim()) return setError('Indique el motivo del contraturno.');
    setEnviando(true);
    setError(null);
    try {
      await onConfirmar(elegida, profesional, motivo.trim());
    } catch {
      setError('No se pudo registrar el contraturno. Intente nuevamente.');
      setEnviando(false);
    }
  };

  return (
    <Modal titulo="Registrar contraturno" subtitulo="Asigne una nueva atención para este paciente." onCerrar={onCerrar}>
      {!elegida ? (
        <>
          <Alerta tono="info" titulo="No hay turnos cancelados por tolerancia">
            Cuando un paciente supere los {TOLERANCIA_MINUTOS} minutos, aparecerá aquí.
          </Alerta>
          <div className="modal__acciones">
            <Button onClick={onCerrar}>Volver</Button>
          </div>
        </>
      ) : (
        <form onSubmit={confirmar} noValidate>
          {candidatas.length > 1 && !inicial && (
            <div className="campo">
              <label htmlFor="ct-paciente">Paciente</label>
              <select
                id="ct-paciente"
                className="select"
                value={elegida.turnoId}
                onChange={(e) => {
                  const a = candidatas.find((c) => c.turnoId === e.target.value)!;
                  setElegida(a);
                  setProfesional(a.profesional);
                }}
              >
                {candidatas.map((c) => (
                  <option key={c.turnoId} value={c.turnoId}>
                    {c.paciente} · {c.numero}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div className="modal__paciente">
            <strong>
              {elegida.paciente} · {elegida.numero}
            </strong>
            <StatusChip estado="cancelado-tolerancia" />
            <span>
              Turno {hora(elegida.horaTurno)} · tolerancia hasta {hora(masMinutos(elegida.horaTurno, TOLERANCIA_MINUTOS))}
              {elegida.canceladoEn && ` · cancelado ${hora(elegida.canceladoEn)}`}
            </span>
          </div>
          <div className="campo">
            <label htmlFor="ct-profesional">Profesional</label>
            <select id="ct-profesional" className="select" value={profesional} onChange={(e) => setProfesional(e.target.value)}>
              {PROFESIONALES.map((p) => (
                <option key={p.nombre} value={p.nombre}>
                  {p.nombre} · {p.especialidad}
                </option>
              ))}
            </select>
          </div>
          <div className="campo">
            <label htmlFor="ct-motivo">Motivo del contraturno</label>
            <input id="ct-motivo" className="input" value={motivo} onChange={(e) => setMotivo(e.target.value)} />
          </div>
          {error && <p className="campo__error" role="alert">{error}</p>}
          <p className="modal__nota">El contraturno se registra solo al confirmar.</p>
          <div className="modal__acciones">
            <Button variant="secondary" onClick={onCerrar} disabled={enviando}>
              Volver
            </Button>
            <Button type="submit" loading={enviando}>
              {enviando ? 'Registrando…' : 'Confirmar'}
            </Button>
          </div>
        </form>
      )}
    </Modal>
  );
}

type DemandaProps = {
  onCerrar: () => void;
  onConfirmar: (paciente: string, profesional: string) => Promise<void>;
};

export function ModalDemanda({ onCerrar, onConfirmar }: DemandaProps) {
  const [paciente, setPaciente] = useState('');
  const [profesional, setProfesional] = useState(PROFESIONALES[0].nombre);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const confirmar = async (e: FormEvent) => {
    e.preventDefault();
    if (paciente.trim().length < 3) return setError('Ingrese el nombre y la inicial del apellido.');
    setEnviando(true);
    setError(null);
    try {
      await onConfirmar(paciente.trim(), profesional);
    } catch {
      setError('No se pudo registrar al paciente. Intente nuevamente.');
      setEnviando(false);
    }
  };

  return (
    <Modal titulo="Demanda espontánea" subtitulo="Incorpore a la cola del día a un paciente sin turno." onCerrar={onCerrar}>
      <form onSubmit={confirmar} noValidate>
        <div className="campo">
          <label htmlFor="de-paciente">Paciente</label>
          <input
            id="de-paciente"
            className={`input ${error ? 'input--error' : ''}`}
            placeholder="Nombre e inicial del apellido, por ejemplo: Luis T."
            value={paciente}
            aria-invalid={!!error}
            onChange={(e) => setPaciente(e.target.value)}
          />
        </div>
        <div className="campo">
          <label htmlFor="de-profesional">Profesional</label>
          <select id="de-profesional" className="select" value={profesional} onChange={(e) => setProfesional(e.target.value)}>
            {PROFESIONALES.map((p) => (
              <option key={p.nombre} value={p.nombre}>
                {p.nombre} · {p.especialidad}
              </option>
            ))}
          </select>
        </div>
        {error && <p className="campo__error" role="alert">{error}</p>}
        <p className="modal__nota">Se ubica en la cola del profesional según su hora de llegada.</p>
        <div className="modal__acciones">
          <Button variant="secondary" onClick={onCerrar} disabled={enviando}>
            Volver
          </Button>
          <Button type="submit" loading={enviando}>
            {enviando ? 'Registrando…' : 'Registrar'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

type AsignarProps = {
  admision: Admision; // demanda espontánea del tótem sin profesional
  onCerrar: () => void;
  onConfirmar: (admision: Admision, profesional: string) => Promise<void>;
};

/** DEV-33: asignar profesional a una demanda espontánea registrada en el tótem. */
export function ModalAsignar({ admision, onCerrar, onConfirmar }: AsignarProps) {
  // Primero los profesionales del servicio que eligió el paciente.
  const delServicio = admision.servicio ? profesionalesDelServicio(admision.servicio) : [];
  const opciones = [...delServicio, ...PROFESIONALES.filter((p) => !delServicio.includes(p))];
  const [profesional, setProfesional] = useState(opciones[0].nombre);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const confirmar = async (e: FormEvent) => {
    e.preventDefault();
    setEnviando(true);
    setError(null);
    try {
      await onConfirmar(admision, profesional);
    } catch {
      setError('No se pudo asignar el profesional. Intente nuevamente.');
      setEnviando(false);
    }
  };

  return (
    <Modal titulo="Asignar profesional" subtitulo="Paciente sin turno registrado en el tótem." onCerrar={onCerrar}>
      <form onSubmit={confirmar} noValidate>
        <div className="modal__paciente">
          <strong>
            {admision.paciente} · {admision.numero}
          </strong>
          <StatusChip estado="en-espera" />
          <span>
            {admision.servicio ?? 'Demanda espontánea'} · llegó {hora(admision.registradaEn)} · espera {minutosEntre(admision.registradaEn, new Date())} min
          </span>
        </div>
        <div className="campo">
          <label htmlFor="as-profesional">Profesional</label>
          <select id="as-profesional" className="select" value={profesional} onChange={(e) => setProfesional(e.target.value)}>
            {opciones.map((p) => (
              <option key={p.nombre} value={p.nombre}>
                {p.nombre} · {p.especialidad} · Consultorio {p.consultorio}
              </option>
            ))}
          </select>
        </div>
        {error && <p className="campo__error" role="alert">{error}</p>}
        <p className="modal__nota">Conserva el número {admision.numero} y la hora de llegada.</p>
        <div className="modal__acciones">
          <Button variant="secondary" onClick={onCerrar} disabled={enviando}>
            Volver
          </Button>
          <Button type="submit" loading={enviando}>
            {enviando ? 'Asignando…' : 'Asignar'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
