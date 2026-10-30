import { useState, type FormEvent } from 'react';
import { Button } from '../../componentes/Button';
import { Alerta } from '../../componentes/Alerta';
import { parametros, nombreSucursal } from '../../servicios/configuracion';
import { DURACIONES, LARGO_MAXIMO_AVISO, MENSAJES_PREDEFINIDOS, problemaConAviso, vencimiento } from '../../servicios/avisos';
import type { Admision } from '../../servicios/turnos';
import { hora } from '../../utilidades/fechas';
import { Modal } from './Modal';

const mensajeError = (e: unknown, porDefecto: string) => (e instanceof Error && e.name === 'OperacionNoPermitidaError' ? e.message : porDefecto);

// ---------- DEV-49: prioridad de atención ----------

type PrioridadProps = {
  admision: Admision;
  onCerrar: () => void;
  onConfirmar: (admision: Admision, motivo: string | null) => Promise<void>;
};

export function ModalPrioridad({ admision, onCerrar, onConfirmar }: PrioridadProps) {
  const motivos = parametros().motivosPrioridad;
  const [motivo, setMotivo] = useState(admision.prioridad?.motivo ?? motivos[0] ?? '');
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const enviar = async (valor: string | null) => {
    setEnviando(true);
    setError(null);
    try {
      await onConfirmar(admision, valor);
    } catch (err) {
      setError(mensajeError(err, 'No se pudo guardar la prioridad. Intente nuevamente.'));
      setEnviando(false);
    }
  };

  return (
    <Modal
      titulo={admision.prioridad ? 'Prioridad de atención' : 'Dar prioridad'}
      subtitulo={`${admision.numero} · ${admision.paciente} · pasa adelante en la cola de ${admision.profesional || 'su profesional'}`}
      onCerrar={onCerrar}
    >
      <form
        onSubmit={(e: FormEvent) => {
          e.preventDefault();
          enviar(motivo);
        }}
        noValidate
      >
        <div className="campo">
          <label htmlFor="pr-motivo">Motivo</label>
          <select id="pr-motivo" className="select" value={motivo} onChange={(e) => setMotivo(e.target.value)}>
            {motivos.map((m) => (
              <option key={m}>{m}</option>
            ))}
          </select>
        </div>
        {admision.prioridad && (
          <p className="modal__nota">
            Prioridad actual: {admision.prioridad.motivo} · marcada por {admision.prioridad.usuario} a las {hora(admision.prioridad.fecha)}.
          </p>
        )}
        {error && (
          <p className="campo__error" role="alert">
            {error}
          </p>
        )}
        <p className="modal__nota">Queda registrado quién, cuándo y por qué. La sala no muestra el motivo. Los motivos los define dirección.</p>
        <div className="modal__acciones">
          <Button variant="secondary" onClick={onCerrar} disabled={enviando}>
            Volver
          </Button>
          {admision.prioridad && (
            <Button variant="secondary" onClick={() => enviar(null)} disabled={enviando}>
              Quitar prioridad
            </Button>
          )}
          <Button type="submit" loading={enviando} disabled={!motivo}>
            {admision.prioridad ? 'Cambiar motivo' : 'Dar prioridad'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

// ---------- DEV-55: aviso general en la sala ----------

type AvisoProps = {
  sucursales: string[];
  sucursalActual: string;
  nombresPacientes: string[];
  onCerrar: () => void;
  onConfirmar: (datos: { texto: string; hasta: Date; sucursal: string }) => Promise<void>;
};

export function ModalAvisoSala({ sucursales, sucursalActual, nombresPacientes, onCerrar, onConfirmar }: AvisoProps) {
  const [texto, setTexto] = useState('');
  const [duracion, setDuracion] = useState(1); // 30 minutos
  const [sucursal, setSucursal] = useState(sucursalActual);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const hasta = vencimiento(DURACIONES[duracion].minutos);

  const confirmar = async (e: FormEvent) => {
    e.preventDefault();
    const problema = problemaConAviso(texto, nombresPacientes);
    if (problema) return setError(problema);
    setEnviando(true);
    setError(null);
    try {
      await onConfirmar({ texto, hasta: vencimiento(DURACIONES[duracion].minutos), sucursal });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo publicar el aviso.');
      setEnviando(false);
    }
  };

  return (
    <Modal titulo="Aviso en la pantalla de sala" subtitulo="Se muestra debajo de los llamados, sin tapar el número." onCerrar={onCerrar}>
      <form onSubmit={confirmar} noValidate>
        <fieldset className="modal__predefinidos">
          <legend>Mensajes frecuentes</legend>
          {MENSAJES_PREDEFINIDOS.map((m) => (
            <button
              key={m}
              type="button"
              className={`sec__opcion ${texto === m ? 'sec__opcion--elegida' : ''}`}
              onClick={() => {
                setTexto(m);
                setError(null);
              }}
            >
              {m}
            </button>
          ))}
        </fieldset>
        <div className="campo">
          <label htmlFor="av-texto">Mensaje</label>
          <textarea
            id="av-texto"
            className={`input sec__textarea ${error ? 'input--error' : ''}`}
            rows={3}
            maxLength={LARGO_MAXIMO_AVISO}
            value={texto}
            aria-invalid={!!error}
            aria-describedby="av-ayuda"
            onChange={(e) => {
              setTexto(e.target.value);
              setError(null);
            }}
          />
          <span id="av-ayuda" className="modal__nota">
            {texto.length}/{LARGO_MAXIMO_AVISO} · sin nombres, documentos ni teléfonos de pacientes.
          </span>
        </div>
        <div className="sec__campos-fila">
          <div className="campo">
            <label htmlFor="av-duracion">Se muestra</label>
            <select id="av-duracion" className="select" value={duracion} onChange={(e) => setDuracion(Number(e.target.value))}>
              {DURACIONES.map((d, i) => (
                <option key={d.etiqueta} value={i}>
                  {d.etiqueta}
                </option>
              ))}
            </select>
          </div>
          <div className="campo">
            <label htmlFor="av-sucursal">Sucursal</label>
            <select id="av-sucursal" className="select" value={sucursal} onChange={(e) => setSucursal(e.target.value)} disabled={sucursales.length < 2}>
              {sucursales.map((s) => (
                <option key={s} value={s}>
                  {nombreSucursal(s)}
                </option>
              ))}
            </select>
          </div>
        </div>
        <p className="modal__nota">Hasta las {hora(hasta)}. Lo puede quitar antes desde el panel.</p>
        {error && <Alerta tono="error" titulo={error} />}
        <div className="modal__acciones">
          <Button variant="secondary" onClick={onCerrar} disabled={enviando}>
            Volver
          </Button>
          <Button type="submit" loading={enviando}>
            Publicar en la sala
          </Button>
        </div>
      </form>
    </Modal>
  );
}
