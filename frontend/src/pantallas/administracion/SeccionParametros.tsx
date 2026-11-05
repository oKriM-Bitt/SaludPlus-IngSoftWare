import { useState, type FormEvent } from 'react';
import { Icon } from '../../componentes/Icon';
import { Button } from '../../componentes/Button';
import { Alerta } from '../../componentes/Alerta';
import { LIMITES, PARAMETROS_POR_DEFECTO, validarParametros, type Parametros } from '../../servicios/configuracion';
import { cambiar } from './cambios';
import { useConfiguracion } from './comun';
import { useConfirmar } from '../../componentes/Confirmar';

type Numericos = Exclude<keyof Parametros, 'motivosPrioridad'>;

/** #77: valores que antes estaban fijos en el código. Se aplican sin reiniciar. */
export function SeccionParametros() {
  const config = useConfiguracion();
  const [valores, setValores] = useState<Record<Numericos, string>>(() => aTexto(config.parametros));
  const [motivos, setMotivos] = useState(config.parametros.motivosPrioridad.join('\n'));
  const [errores, setErrores] = useState<Partial<Record<keyof Parametros, string>>>({});
  const [aviso, setAviso] = useState<string | null>(null);
  const { confirmar, dialogo } = useConfirmar(); // #87

  const armar = (): Parametros => ({
    ...(Object.fromEntries(Object.entries(valores).map(([k, v]) => [k, v.trim() === '' ? NaN : Number(v)])) as Record<Numericos, number>),
    motivosPrioridad: motivos.split('\n').map((m) => m.trim()).filter(Boolean),
  });

  const guardar = (e: FormEvent) => {
    e.preventDefault();
    const nuevos = armar();
    const problemas = validarParametros(nuevos);
    setErrores(problemas);
    if (Object.keys(problemas).length) return setAviso(null);
    const cambios = (Object.keys(LIMITES) as Numericos[]).filter((k) => nuevos[k] !== config.parametros[k]).map((k) => `${LIMITES[k][2]}: ${config.parametros[k]} → ${nuevos[k]}`);
    if (nuevos.motivosPrioridad.join('|') !== config.parametros.motivosPrioridad.join('|')) cambios.push('Motivos de prioridad');
    if (cambios.length === 0) return setAviso('No hay cambios para guardar.');
    cambiar(cambios.join(' · '), (c) => ({ ...c, parametros: nuevos }), 'parametros');
    setAviso(`Se guardaron los parámetros (${cambios.length} cambios). Ya se aplican en todas las pantallas.`);
  };

  const restaurar = async () => {
    const acepta = await confirmar({
      titulo: '¿Restaurar los valores por defecto?',
      mensaje: 'Se reemplazan todos los parámetros por los acordados al inicio y se aplican enseguida en todas las pantallas.',
      aceptar: 'Restaurar valores',
    });
    if (!acepta) return;
    setValores(aTexto(PARAMETROS_POR_DEFECTO));
    setMotivos(PARAMETROS_POR_DEFECTO.motivosPrioridad.join('\n'));
    setErrores({});
    cambiar('Parámetros restaurados a los valores por defecto', (c) => ({ ...c, parametros: { ...PARAMETROS_POR_DEFECTO, motivosPrioridad: [...PARAMETROS_POR_DEFECTO.motivosPrioridad] } }), 'parametros');
    setAviso('Se restauraron los valores por defecto.');
  };

  return (
    <section className="tarjeta">
      <h2>Parámetros del sistema</h2>
      <p className="tarjeta__ayuda">Valores acordados con SaludPlus. Cada cambio queda registrado con su valor anterior.</p>
      {aviso && <Alerta tono={aviso.startsWith('No hay') ? 'info' : 'success'} titulo={aviso} />}
      <form className="admin__form admin__form--plano" onSubmit={guardar} noValidate>
        <div className="admin__campos admin__campos--parametros">
          {(Object.keys(LIMITES) as Numericos[]).map((k) => {
            const [min, max, etiqueta, unidad] = LIMITES[k];
            return (
              <div key={k} className="campo">
                <label htmlFor={`par-${k}`}>{etiqueta}</label>
                <div className="admin__numero">
                  <input
                    id={`par-${k}`}
                    className={`input ${errores[k] ? 'input--error' : ''}`}
                    inputMode="numeric"
                    value={valores[k]}
                    aria-invalid={!!errores[k]}
                    aria-describedby={`par-${k}-ayuda`}
                    onChange={(e) => setValores((v) => ({ ...v, [k]: e.target.value.replace(/[^\d]/g, '').slice(0, 3) }))}
                  />
                  <span>{unidad}</span>
                </div>
                <span id={`par-${k}-ayuda`} className={errores[k] ? 'campo__error' : 'admin__sub'}>
                  {errores[k] ?? `Entre ${min} y ${max}. Por defecto: ${PARAMETROS_POR_DEFECTO[k]}.`}
                </span>
              </div>
            );
          })}
        </div>
        <div className="campo">
          <label htmlFor="par-motivos">Motivos de prioridad de atención (uno por línea)</label>
          <textarea
            id="par-motivos"
            className={`input admin__textarea ${errores.motivosPrioridad ? 'input--error' : ''}`}
            rows={5}
            value={motivos}
            aria-invalid={!!errores.motivosPrioridad}
            onChange={(e) => setMotivos(e.target.value)}
          />
          {errores.motivosPrioridad && <span className="campo__error">{errores.motivosPrioridad}</span>}
        </div>
        <div className="admin__botones">
          <Button variant="secondary" className="btn--compacto" icon={<Icon name="undo" size={20} />} onClick={restaurar}>
            Restaurar valores por defecto
          </Button>
          <Button type="submit" className="btn--compacto" icon={<Icon name="check" size={20} />}>
            Guardar parámetros
          </Button>
        </div>
      </form>
      {dialogo}
    </section>
  );
}

function aTexto(p: Parametros): Record<Numericos, string> {
  return Object.fromEntries((Object.keys(LIMITES) as Numericos[]).map((k) => [k, String(p[k])])) as Record<Numericos, string>;
}
