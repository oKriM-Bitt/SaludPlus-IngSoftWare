import { useState, type FormEvent } from 'react';
import { Button } from '../../componentes/Button';
import { StatusChip } from '../../componentes/StatusChip';
import { Alerta } from '../../componentes/Alerta';
import { PROFESIONALES, type Admision, type EstadoProfesional, type Profesional } from '../../servicios/turnos';
import { hora, minutosEntre } from '../../utilidades/fechas';
import { Modal } from './Modal';

const mensajeError = (e: unknown, porDefecto: string) => (e instanceof Error && e.name === 'OperacionNoPermitidaError' ? e.message : porDefecto);

/** Opciones de profesional: primero los de la misma especialidad, sin el profesional actual. */
function opcionesPara(especialidad: string | undefined, excluir: string): Profesional[] {
  const otros = PROFESIONALES.filter((p) => p.nombre !== excluir);
  const misma = otros.filter((p) => p.especialidad === especialidad);
  return [...misma, ...otros.filter((p) => !misma.includes(p))];
}

function Paciente({ admision }: { admision: Admision }) {
  return (
    <div className="modal__paciente">
      <strong>
        {admision.paciente} · {admision.numero}
      </strong>
      <StatusChip estado="en-espera" />
      <span>
        {admision.profesional || 'Sin profesional'} · llegó {hora(admision.registradaEn)} · espera {minutosEntre(admision.registradaEn, new Date())} min
      </span>
    </div>
  );
}

// ---------- #58: derivar a otro profesional ----------

const MOTIVOS_DERIVACION = ['Otra especialidad', 'El profesional no está disponible', 'Pedido del paciente', 'Mejor espera con otro profesional', 'Otro'];

type DerivarProps = {
  admision: Admision;
  especialidad?: string;
  onCerrar: () => void;
  onConfirmar: (admision: Admision, profesional: string, motivo: string) => Promise<void>;
};

export function ModalDerivar({ admision, especialidad, onCerrar, onConfirmar }: DerivarProps) {
  const opciones = opcionesPara(especialidad, admision.profesional);
  const [profesional, setProfesional] = useState(opciones[0]?.nombre ?? '');
  const [motivo, setMotivo] = useState(MOTIVOS_DERIVACION[0]);
  const [detalle, setDetalle] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const confirmar = async (e: FormEvent) => {
    e.preventDefault();
    if (motivo === 'Otro' && !detalle.trim()) return setError('Escriba el motivo de la derivación.');
    setEnviando(true);
    setError(null);
    try {
      await onConfirmar(admision, profesional, motivo === 'Otro' ? detalle.trim() : motivo);
    } catch (err) {
      setError(mensajeError(err, 'No se pudo derivar al paciente. Intente nuevamente.'));
      setEnviando(false);
    }
  };

  return (
    <Modal titulo="Derivar a otro profesional" subtitulo="El paciente conserva su número y el tiempo que ya esperó." onCerrar={onCerrar}>
      {opciones.length === 0 ? (
        <>
          <Alerta tono="info" titulo="No hay otro profesional atendiendo hoy en esta sucursal" />
          <div className="modal__acciones">
            <Button onClick={onCerrar}>Volver</Button>
          </div>
        </>
      ) : (
        <form onSubmit={confirmar} noValidate>
          <Paciente admision={admision} />
          <div className="campo">
            <label htmlFor="dv-profesional">Derivar a</label>
            <select id="dv-profesional" className="select" value={profesional} onChange={(e) => setProfesional(e.target.value)}>
              {opciones.map((p) => (
                <option key={p.nombre} value={p.nombre}>
                  {p.nombre} · {p.especialidad} · Consultorio {p.consultorio}
                </option>
              ))}
            </select>
          </div>
          <div className="campo">
            <label htmlFor="dv-motivo">Motivo</label>
            <select id="dv-motivo" className="select" value={motivo} onChange={(e) => setMotivo(e.target.value)}>
              {MOTIVOS_DERIVACION.map((m) => (
                <option key={m}>{m}</option>
              ))}
            </select>
          </div>
          {motivo === 'Otro' && (
            <div className="campo">
              <label htmlFor="dv-detalle">Detalle del motivo</label>
              <input id="dv-detalle" className="input" value={detalle} onChange={(e) => setDetalle(e.target.value)} />
            </div>
          )}
          {error && <p className="campo__error" role="alert">{error}</p>}
          <p className="modal__nota">La derivación queda registrada: quién, cuándo, desde y hacia qué profesional.</p>
          <div className="modal__acciones">
            <Button variant="secondary" onClick={onCerrar} disabled={enviando}>
              Volver
            </Button>
            <Button type="submit" loading={enviando}>
              {enviando ? 'Derivando…' : 'Derivar'}
            </Button>
          </div>
        </form>
      )}
    </Modal>
  );
}

// ---------- #64: se retiró sin ser atendido ----------

const MOTIVOS_RETIRO = ['No informó el motivo', 'Demora en la atención', 'Se sintió mejor', 'Tuvo que irse', 'Fue a una guardia'];

type RetiroProps = { admision: Admision; onCerrar: () => void; onConfirmar: (admision: Admision, motivo: string) => Promise<void> };

export function ModalSeRetiro({ admision, onCerrar, onConfirmar }: RetiroProps) {
  const [motivo, setMotivo] = useState(MOTIVOS_RETIRO[0]);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const confirmar = async (e: FormEvent) => {
    e.preventDefault();
    setEnviando(true);
    setError(null);
    try {
      await onConfirmar(admision, motivo === MOTIVOS_RETIRO[0] ? '' : motivo);
    } catch (err) {
      setError(mensajeError(err, 'No se pudo registrar. Intente nuevamente.'));
      setEnviando(false);
    }
  };

  return (
    <Modal titulo="El paciente se retiró" subtitulo="Sale de la cola y de la espera estimada. Si vuelve, se lo reincorpora con su mismo número." onCerrar={onCerrar}>
      <form onSubmit={confirmar} noValidate>
        <Paciente admision={admision} />
        <div className="campo">
          <label htmlFor="sr-motivo">Motivo, si lo sabe</label>
          <select id="sr-motivo" className="select" value={motivo} onChange={(e) => setMotivo(e.target.value)}>
            {MOTIVOS_RETIRO.map((m) => (
              <option key={m}>{m}</option>
            ))}
          </select>
        </div>
        {error && <p className="campo__error" role="alert">{error}</p>}
        <p className="modal__nota">Los indicadores cuentan los abandonos por separado de las ausencias.</p>
        <div className="modal__acciones">
          <Button variant="secondary" onClick={onCerrar} disabled={enviando}>
            Volver
          </Button>
          <Button type="submit" loading={enviando}>
            {enviando ? 'Registrando…' : 'Confirmar'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

// ---------- #65: anular una llegada registrada por error ----------

const MOTIVOS_ANULACION = ['Eligió un turno equivocado', 'Se registró a otra persona', 'Llegada registrada dos veces', 'Otro'];

type AnularProps = { admision: Admision; onCerrar: () => void; onConfirmar: (admision: Admision, motivo: string) => Promise<void> };

export function ModalAnular({ admision, onCerrar, onConfirmar }: AnularProps) {
  const [motivo, setMotivo] = useState(MOTIVOS_ANULACION[0]);
  const [detalle, setDetalle] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const confirmar = async (e: FormEvent) => {
    e.preventDefault();
    if (motivo === 'Otro' && !detalle.trim()) return setError('Escriba el motivo de la anulación.');
    setEnviando(true);
    setError(null);
    try {
      await onConfirmar(admision, motivo === 'Otro' ? detalle.trim() : motivo);
    } catch (err) {
      setError(mensajeError(err, 'No se pudo anular la llegada. Intente nuevamente.'));
      setEnviando(false);
    }
  };

  return (
    <Modal titulo="Anular llegada" subtitulo="Para corregir un registro hecho por error. El turno vuelve a quedar disponible." onCerrar={onCerrar}>
      <form onSubmit={confirmar} noValidate>
        <Paciente admision={admision} />
        <Alerta tono="warning" titulo={`El número ${admision.numero} deja de estar en la cola`}>
          La anulación queda registrada con su usuario y el motivo.
        </Alerta>
        <div className="campo">
          <label htmlFor="an-motivo">Motivo</label>
          <select id="an-motivo" className="select" value={motivo} onChange={(e) => setMotivo(e.target.value)}>
            {MOTIVOS_ANULACION.map((m) => (
              <option key={m}>{m}</option>
            ))}
          </select>
        </div>
        {motivo === 'Otro' && (
          <div className="campo">
            <label htmlFor="an-detalle">Detalle del motivo</label>
            <input id="an-detalle" className="input" value={detalle} onChange={(e) => setDetalle(e.target.value)} />
          </div>
        )}
        {error && <p className="campo__error" role="alert">{error}</p>}
        <div className="modal__acciones">
          <Button variant="secondary" onClick={onCerrar} disabled={enviando}>
            Volver
          </Button>
          <Button type="submit" loading={enviando}>
            {enviando ? 'Anulando…' : 'Anular llegada'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

// ---------- #63: profesional ausente o demorado ----------

type EstadoProps = {
  profesional: Profesional;
  estadoActual?: EstadoProfesional;
  enEspera: number;
  onCerrar: () => void;
  onConfirmar: (estado: EstadoProfesional['estado'] | null, minutos: number | undefined, derivarA: string | null) => Promise<void>;
};

export function ModalEstadoProfesional({ profesional, estadoActual, enEspera, onCerrar, onConfirmar }: EstadoProps) {
  const opciones = opcionesPara(profesional.especialidad, profesional.nombre);
  const mismaEspecialidad = opciones.filter((p) => p.especialidad === profesional.especialidad);
  const [estado, setEstado] = useState<EstadoProfesional['estado'] | 'normal'>(estadoActual?.estado ?? 'demorado');
  const [minutos, setMinutos] = useState(String(estadoActual?.minutos ?? 30));
  const [derivar, setDerivar] = useState(false);
  const [destino, setDestino] = useState(mismaEspecialidad[0]?.nombre ?? opciones[0]?.nombre ?? '');
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const confirmar = async (e: FormEvent) => {
    e.preventDefault();
    const m = Number(minutos);
    if (estado === 'demorado' && (!Number.isInteger(m) || m < 5 || m > 240)) return setError('Indique una demora entre 5 y 240 minutos.');
    setEnviando(true);
    setError(null);
    try {
      await onConfirmar(estado === 'normal' ? null : estado, estado === 'demorado' ? m : undefined, derivar && estado !== 'normal' && destino ? destino : null);
    } catch (err) {
      setError(mensajeError(err, 'No se pudo guardar el aviso. Intente nuevamente.'));
      setEnviando(false);
    }
  };

  return (
    <Modal titulo={`${profesional.nombre} · Consultorio ${profesional.consultorio}`} subtitulo="La sala informa la demora o la ausencia sin mostrar datos de pacientes." onCerrar={onCerrar}>
      <form onSubmit={confirmar} noValidate>
        <fieldset className="modal__opciones">
          <legend>Estado de hoy</legend>
          {(
            [
              ['demorado', 'Llega tarde o está demorado'],
              ['ausente', 'No viene hoy'],
              ['normal', 'Atiende con normalidad (quitar aviso)'],
            ] as const
          ).map(([valor, texto]) => (
            <label key={valor} className="modal__opcion">
              <input type="radio" name="estado-prof" value={valor} checked={estado === valor} onChange={() => setEstado(valor)} /> {texto}
            </label>
          ))}
        </fieldset>
        {estado === 'demorado' && (
          <div className="campo">
            <label htmlFor="ep-minutos">Demora estimada (minutos)</label>
            <input id="ep-minutos" className="input" inputMode="numeric" value={minutos} onChange={(e) => setMinutos(e.target.value.replace(/\D/g, '').slice(0, 3))} />
          </div>
        )}
        {estado !== 'normal' && enEspera > 0 && opciones.length > 0 && (
          <>
            <label className="modal__opcion">
              <input type="checkbox" checked={derivar} onChange={(e) => setDerivar(e.target.checked)} /> {enEspera === 1 ? 'Derivar a su paciente en espera' : `Derivar a sus ${enEspera} pacientes en espera`}
            </label>
            {derivar && (
              <div className="campo">
                <label htmlFor="ep-destino">Derivar a</label>
                <select id="ep-destino" className="select" value={destino} onChange={(e) => setDestino(e.target.value)}>
                  {opciones.map((p) => (
                    <option key={p.nombre} value={p.nombre}>
                      {p.nombre} · {p.especialidad} · Consultorio {p.consultorio}
                    </option>
                  ))}
                </select>
                {mismaEspecialidad.length === 0 && <p className="modal__nota">No hay otro profesional de {profesional.especialidad} hoy: elija uno de otra especialidad o avise a los pacientes.</p>}
              </div>
            )}
          </>
        )}
        {error && <p className="campo__error" role="alert">{error}</p>}
        <div className="modal__acciones">
          <Button variant="secondary" onClick={onCerrar} disabled={enviando}>
            Volver
          </Button>
          <Button type="submit" loading={enviando}>
            {enviando ? 'Guardando…' : 'Guardar'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
