import {
  BadRequestException, ConflictException, Injectable, Logger, NotFoundException,
} from '@nestjs/common';
import { DataSource, QueryRunner } from 'typeorm';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { UsuariosService } from '../usuarios/usuarios.service';
import { CreateEgresadoEtapa2Dto } from '../egresados/dto/create-egresado-etapa2.dto';
import { EstadoCandidato, ListarDuplicadosDto } from './dto/listar-duplicados.dto';
import { FusionarDuplicadosDto } from './dto/fusionar-duplicados.dto';
import { ListarFusionesDto } from './dto/listar-fusiones.dto';

// ─────────────────────────────────────────────────────────────────────────────
// DETECCIÓN Y FUSIÓN DE EGRESADOS DUPLICADOS (Fase 6)
//
// Reglas de este servicio:
//  · El detector solo PROPONE pares en duplicados_candidatos. Nunca fusiona
//    ni borra egresados por su cuenta.
//  · La fusión (fusionar) solo ocurre a petición explícita de un
//    administrador y solo entre egresados que el detector conectó.
//  · Las columnas numero_control_norm, telefono_norm, nombre_norm y
//    correo_local_norm son STORED GENERATED: solo se LEEN. Incluirlas en un
//    INSERT o UPDATE truena con el error 3105.
//  · Una decisión del administrador (confirmado / descartado) nunca se pisa
//    al re-ejecutar el detector: el upsert solo toca filas en 'pendiente'.
//  · mysql2 devuelve COUNT()/SUM() como string: todo agregado pasa por Number().
// ─────────────────────────────────────────────────────────────────────────────

// Puntos por señal. El total se topa en 100 (la columna es 0-100).
const PUNTOS = {
  num_control: 50,
  telefono: 30,
  nombre: 25,
  nombre_reordenado: 25,
  correo: 20,
  carrera: 10,
  anios_cercanos: 10,
} as const;

const TAM_LOTE = 500;
const LIMIT_DEFAULT = 50;

// ─────────────────────────────────────────────────────────────────────────────
// TABLAS HIJAS de egresados.id_egresado que la fusión reasigna.
//
// Lista ESCRITA A MANO a propósito (auditable). Se obtuvo de
// information_schema.KEY_COLUMN_USAGE / REFERENTIAL_CONSTRAINTS y
// information_schema.STATISTICS. Si agregas una tabla con FK a
// egresados.id_egresado, REGÍSTRALA AQUÍ: si no, sus filas del eliminado se
// perderían por la cascada (o quedarían en NULL) sin quedar en el snapshot.
//
// Fuera de la lista a propósito:
//  · duplicados_candidatos: sus filas del eliminado se borran solas por cascada.
//  · duplicados_fusiones: la bitácora; id_egresado_eliminado no tiene FK.
//    Su id_egresado_conservado se re-apunta aparte (ver fusionarUno).
//
// unicoPor: columnas (incluida la del egresado) que identifican "la misma
// fila" para una persona. Si el conservado ya tiene la fila equivalente, se
// queda la suya y la del eliminado NO se mueve (muere con la cascada, pero
// queda en el snapshot). Sin unicoPor, se mueven todas.
//  · UNIQUE real en BD: egresado_identidad (uq_identidad_egresado) y
//    egresado_discapacidad (uq_egresado_dominio).
//  · Unicidad LÓGICA sin índice en BD: autorizaciones es 1:1 con el egresado
//    y se hace LEFT JOIN en todos los listados y estadísticas (una segunda
//    fila duplicaría al egresado en todos lados). egresado_habilidades y
//    egresado_colaboraciones son relaciones con catálogo: repetir el mismo
//    par inflaría los totales de vinculación.
// ─────────────────────────────────────────────────────────────────────────────
interface TablaHija {
  tabla: string;
  columna: string;
  unicoPor?: string[];
}

export const TABLAS_HIJAS: readonly TablaHija[] = [
  { tabla: 'autorizaciones', columna: 'id_egresado', unicoPor: ['id_egresado'] },
  { tabla: 'certificaciones', columna: 'id_egresado' },
  { tabla: 'colaboracion_otro', columna: 'id_egresado' },
  { tabla: 'egresado_colaboraciones', columna: 'id_egresado', unicoPor: ['id_egresado', 'id_colaboracion'] },
  { tabla: 'egresado_discapacidad', columna: 'id_egresado', unicoPor: ['id_egresado', 'id_dominio'] },
  { tabla: 'egresado_emprendimientos', columna: 'id_egresado' },
  { tabla: 'egresado_estudios', columna: 'id_egresado' },
  { tabla: 'egresado_habilidades', columna: 'id_egresado', unicoPor: ['id_egresado', 'id_habilidad'] },
  { tabla: 'egresado_identidad', columna: 'id_egresado', unicoPor: ['id_egresado'] },
  { tabla: 'egresado_proyectos_sociales', columna: 'id_egresado' },
  { tabla: 'habilidades_otro', columna: 'id_egresado' },
  { tabla: 'notificaciones', columna: 'id_egresado' },
];

// Tablas con datos sensibles: solo existen con consentimiento expreso.
const TABLAS_SENSIBLES = ['egresado_identidad', 'egresado_discapacidad'];

// Columnas de PERMISO de autorizaciones (TINYINT(1)). Al fusionar gana la
// respuesta MÁS RESTRICTIVA; ver combinarAutorizaciones.
const PERMISOS_AUTORIZACION = ['autorizo_estadisticas', 'autorizo_contacto', 'autorizo_eventos'] as const;

// Columnas de egresados que la fusión puede RELLENAR en el conservado cuando
// allí están vacías (NULL o '') y el eliminado sí tiene valor.
// Fuera a propósito:
//  · id_egresado, correo (UNIQUE), fecha_registro.
//  · numero_control_norm, telefono_norm, nombre_norm, correo_local_norm:
//    STORED GENERATED; incluirlas en un UPDATE truena con el error 3105.
//  · revisado, fecha_revision, revisado_por: estado del registro, no datos
//    de la persona.
//  · registro_completo: no se copia; se RECALCULA tras el relleno (ver
//    cumpleEtapa2).
//  · consintio_datos_sensibles, fecha_consentimiento_sensibles: viajan junto
//    con las filas sensibles (ver fusionarUno), nunca solas.
// El orden importa: un campo gobernante va antes que sus dependientes.
const CAMPOS_RELLENABLES = [
  'nombre_completo', 'genero_id', 'telefono', 'ciudad_residencia', 'pais_nacimiento',
  'carrera_id', 'anio_ingreso', 'periodo_ingreso', 'anio_egreso', 'nivel_ingles_id',
  'situacion_laboral_id', 'empresa', 'antiguedad_empleo_id', 'ciudad_trabajo', 'puesto_trabajo',
  'tiempo_primer_empleo_id', 'medio_primer_empleo_id', 'medio_primer_empleo_otro',
  'primer_empleo_empresa', 'primer_empleo_puesto',
  'numero_control', 'linkedin', 'facebook', 'instagram',
  'coincidencia_laboral_id', 'estatus_titulacion', 'satisfaccion_formacion', 'foto_url',
] as const;

// Un campo dependiente solo se rellena si su gobernante vale lo mismo en
// ambos registros: si el conservado dice "Desempleado", no se le pone la
// empresa que el eliminado capturó cuando decía "Empleado".
const DEPENDE_DE: Partial<Record<typeof CAMPOS_RELLENABLES[number], typeof CAMPOS_RELLENABLES[number]>> = {
  empresa: 'situacion_laboral_id',
  antiguedad_empleo_id: 'situacion_laboral_id',
  ciudad_trabajo: 'situacion_laboral_id',
  puesto_trabajo: 'situacion_laboral_id',
  medio_primer_empleo_otro: 'medio_primer_empleo_id',
};

const vacio = (v: unknown) =>
  v === null || v === undefined || (typeof v === 'string' && v.trim() === '');

// mysql2 normalmente ya entrega las columnas JSON como objeto.
const leerJson = (v: unknown) => (typeof v === 'string' ? JSON.parse(v) : v ?? null);

const numerosPorClave = (obj: unknown): Record<string, number> | null => {
  const o = leerJson(obj) as Record<string, unknown> | null;
  if (!o) return null;
  return Object.fromEntries(Object.entries(o).map(([k, v]) => [k, Number(v)]));
};

interface EgresadoDetector {
  id_egresado: number;
  numero_control_norm: string | null;
  telefono_norm: string | null;
  correo_local_norm: string | null;
  carrera_id: number | null;
  anio_egreso: number | null;
  // Calculadas en TypeScript (ver prepararEgresado).
  nombre_cmp: string;
  nombre_tokens: string;
}

interface ParCandidato {
  a: number;
  b: number;
  score: number;
  coincide_num_control: boolean;
  coincide_correo: boolean;
  coincide_telefono: boolean;
  coincide_nombre: boolean;
  coincide_carrera: boolean;
  similitud_nombre: number;
  diferencia_anios: number | null;
}

const quitarAcentos = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '');

// null, undefined y cadena vacía nunca empatan: dos nulos NO son una coincidencia.
const iguales = (x: string | number | null | undefined, y: string | number | null | undefined) =>
  x !== null && x !== undefined && x !== '' && x === y;

@Injectable()
export class DuplicadosService {

  private readonly logger = new Logger(DuplicadosService.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly usuariosService: UsuariosService,
  ) { }

  // nombre_norm conserva los acentos: en MySQL no importa porque la colación
  // utf8mb4_0900_ai_ci los ignora al comparar, pero en JS "josé" !== "jose".
  // nombre_cmp replica en TypeScript esa comparación insensible a acentos.
  //
  // nombre_tokens: mismas palabras en cualquier orden. Descarta palabras de
  // una letra (iniciales) y ordena alfabéticamente, de modo que
  //   "pérez lópez ana maría" y "ana maría pérez lópez" -> "ana lopez maria perez"
  private prepararEgresado(fila: any): EgresadoDetector {
    const nombreCmp = quitarAcentos(String(fila.nombre_norm ?? ''))
      .toLowerCase()
      .trim()
      .replace(/\s+/g, ' ');
    const tokens = nombreCmp
      .split(' ')
      .filter(p => p.length > 1)
      .sort()
      .join(' ');

    return {
      id_egresado: Number(fila.id_egresado),
      numero_control_norm: fila.numero_control_norm ?? null,
      telefono_norm: fila.telefono_norm ?? null,
      correo_local_norm: fila.correo_local_norm ?? null,
      carrera_id: fila.carrera_id === null ? null : Number(fila.carrera_id),
      anio_egreso: fila.anio_egreso === null ? null : Number(fila.anio_egreso),
      nombre_cmp: nombreCmp,
      nombre_tokens: tokens,
    };
  }

  // Devuelve null si el par no tiene ninguna señal fuerte.
  private evaluarPar(x: EgresadoDetector, y: EgresadoDetector): ParCandidato | null {
    const coincide_num_control = iguales(x.numero_control_norm, y.numero_control_norm);
    const coincide_telefono = iguales(x.telefono_norm, y.telefono_norm);
    const coincide_nombre = iguales(x.nombre_cmp, y.nombre_cmp);
    const coincide_correo = iguales(x.correo_local_norm, y.correo_local_norm);

    // Mismas palabras en otro orden. Si los nombres ya son idénticos vale 0,
    // así que nunca se suma junto con coincide_nombre.
    const similitud_nombre =
      !coincide_nombre && iguales(x.nombre_tokens, y.nombre_tokens) ? 100 : 0;

    // Carrera y año solo suman puntos; NUNCA crean un candidato por sí solos.
    const senalFuerte = coincide_num_control || coincide_telefono || coincide_nombre
      || coincide_correo || similitud_nombre === 100;
    if (!senalFuerte) return null;

    const coincide_carrera = iguales(x.carrera_id, y.carrera_id);
    const diferencia_anios = x.anio_egreso === null || y.anio_egreso === null
      ? null
      : Math.min(Math.abs(x.anio_egreso - y.anio_egreso), 255); // TINYINT UNSIGNED

    let score = 0;
    if (coincide_num_control) score += PUNTOS.num_control;
    if (coincide_telefono) score += PUNTOS.telefono;
    if (coincide_nombre) score += PUNTOS.nombre;
    if (similitud_nombre === 100) score += PUNTOS.nombre_reordenado;
    if (coincide_correo) score += PUNTOS.correo;
    if (coincide_carrera) score += PUNTOS.carrera;
    if (diferencia_anios !== null && diferencia_anios <= 1) score += PUNTOS.anios_cercanos;

    return {
      // El CHECK de la tabla exige id_egresado_a < id_egresado_b.
      a: Math.min(x.id_egresado, y.id_egresado),
      b: Math.max(x.id_egresado, y.id_egresado),
      score: Math.min(score, 100),
      coincide_num_control,
      coincide_correo,
      coincide_telefono,
      coincide_nombre,
      coincide_carrera,
      similitud_nombre,
      diferencia_anios,
    };
  }

  // Etiquetas legibles de las señales encendidas; el panel muestra esto.
  private etiquetasSenales(c: any): string[] {
    const senales: string[] = [];
    if (Number(c.coincide_num_control) === 1) senales.push('Mismo número de control');
    if (Number(c.coincide_telefono) === 1) senales.push('Mismo teléfono');
    if (Number(c.coincide_nombre) === 1) senales.push('Mismo nombre');
    if (Number(c.similitud_nombre) === 100) senales.push('Mismo nombre en otro orden');
    if (Number(c.coincide_correo) === 1) senales.push('Mismo usuario de correo');
    if (Number(c.coincide_carrera) === 1) senales.push('Misma carrera');
    if (c.diferencia_anios !== null) {
      const dif = Number(c.diferencia_anios);
      if (dif === 0) senales.push('Mismo año de egreso');
      else if (dif === 1) senales.push('Año de egreso con 1 año de diferencia');
    }
    return senales;
  }

  // 1. DETECTAR
  // Recalcula todos los pares y los guarda con upsert por lotes, en una
  // transacción. Al final borra los pares 'pendiente' que ya no salieron en
  // esta corrida (alguien corrigió un dato). 'confirmado' y 'descartado'
  // nunca se borran: son una decisión que ya tomó una persona.
  async detectar(idAdmin: number) {
    const filas: any[] = await this.dataSource.query(`
      SELECT id_egresado, nombre_completo, nombre_norm, numero_control,
             numero_control_norm, telefono_norm, correo_local_norm,
             carrera_id, anio_egreso, registro_completo
      FROM egresados
    `);
    const egresados = filas.map(f => this.prepararEgresado(f));

    // Comparación de todos contra todos: O(n²). Con 500 registros son ~125,000
    // pares y es instantáneo. Si la tabla pasa de ~5,000 registros hay que
    // agregar blocking (comparar solo dentro del mismo carrera_id, o de la
    // misma inicial de nombre_tokens / mismo numero_control_norm, etc.).
    const candidatos: ParCandidato[] = [];
    let paresEvaluados = 0;
    for (let i = 0; i < egresados.length; i++) {
      for (let j = i + 1; j < egresados.length; j++) {
        paresEvaluados++;
        const par = this.evaluarPar(egresados[i], egresados[j]);
        if (par) candidatos.push(par);
      }
    }

    let nuevos = 0;
    let actualizados = 0;
    let respetados = 0;
    let eliminados = 0;

    const qr = this.dataSource.createQueryRunner();
    await qr.connect();
    await qr.startTransaction();
    try {
      // Estado actual de todos los pares ya guardados, para clasificar el
      // resultado (nuevo / actualizado / respetado).
      const existentes: { id_candidato: number; id_egresado_a: number; id_egresado_b: number; estado: EstadoCandidato }[] =
        await qr.query(`
          SELECT id_candidato, id_egresado_a, id_egresado_b, estado
          FROM duplicados_candidatos
          FOR UPDATE
        `);
      const estadoPorPar = new Map<string, EstadoCandidato>();
      for (const e of existentes) {
        estadoPorPar.set(`${Number(e.id_egresado_a)}-${Number(e.id_egresado_b)}`, e.estado);
      }

      for (const c of candidatos) {
        const estado = estadoPorPar.get(`${c.a}-${c.b}`);
        if (estado === undefined) nuevos++;
        else if (estado === 'pendiente') actualizados++;
        else respetados++;
      }

      // Solo las filas en 'pendiente' reciben el nuevo score y señales; una
      // decisión del administrador nunca se borra al re-ejecutar. `estado`
      // no se asigna aquí, así que cada IF lee el estado original de la fila.
      for (let i = 0; i < candidatos.length; i += TAM_LOTE) {
        const lote = candidatos.slice(i, i + TAM_LOTE);
        const params: (number | null)[] = [];
        for (const c of lote) {
          params.push(
            c.a, c.b, c.score,
            c.coincide_num_control ? 1 : 0,
            c.coincide_correo ? 1 : 0,
            c.coincide_telefono ? 1 : 0,
            c.coincide_nombre ? 1 : 0,
            c.coincide_carrera ? 1 : 0,
            c.similitud_nombre,
            c.diferencia_anios,
          );
        }
        await qr.query(
          `INSERT INTO duplicados_candidatos
             (id_egresado_a, id_egresado_b, score,
              coincide_num_control, coincide_correo, coincide_telefono,
              coincide_nombre, coincide_carrera, similitud_nombre, diferencia_anios)
           VALUES ${lote.map(() => '(?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').join(', ')}
           ON DUPLICATE KEY UPDATE
             score                = IF(estado = 'pendiente', VALUES(score),                score),
             coincide_num_control = IF(estado = 'pendiente', VALUES(coincide_num_control), coincide_num_control),
             coincide_correo      = IF(estado = 'pendiente', VALUES(coincide_correo),      coincide_correo),
             coincide_telefono    = IF(estado = 'pendiente', VALUES(coincide_telefono),    coincide_telefono),
             coincide_nombre      = IF(estado = 'pendiente', VALUES(coincide_nombre),      coincide_nombre),
             coincide_carrera     = IF(estado = 'pendiente', VALUES(coincide_carrera),     coincide_carrera),
             similitud_nombre     = IF(estado = 'pendiente', VALUES(similitud_nombre),     similitud_nombre),
             diferencia_anios     = IF(estado = 'pendiente', VALUES(diferencia_anios),     diferencia_anios),
             detectado_en         = IF(estado = 'pendiente', NOW(),                        detectado_en)`,
          params,
        );
      }

      // Pendientes fantasma: estaban guardados pero esta corrida ya no los
      // produjo. El AND estado = 'pendiente' del DELETE es la segunda red.
      const paresCorrida = new Set(candidatos.map(c => `${c.a}-${c.b}`));
      const obsoletos = existentes
        .filter(e => e.estado === 'pendiente'
          && !paresCorrida.has(`${Number(e.id_egresado_a)}-${Number(e.id_egresado_b)}`))
        .map(e => Number(e.id_candidato));
      for (let i = 0; i < obsoletos.length; i += TAM_LOTE) {
        const res = await qr.query(
          `DELETE FROM duplicados_candidatos
           WHERE estado = 'pendiente' AND id_candidato IN (?)`,
          [obsoletos.slice(i, i + TAM_LOTE)],
        );
        eliminados += Number(res?.affectedRows ?? 0);
      }

      await qr.commitTransaction();
    } catch (err) {
      if (qr.isTransactionActive) await qr.rollbackTransaction();
      throw err;
    } finally {
      await qr.release();
    }

    const [pend] = await this.dataSource.query(
      `SELECT COUNT(*) AS total FROM duplicados_candidatos WHERE estado = 'pendiente'`,
    );

    const resumen = {
      total_egresados: egresados.length,
      pares_evaluados: paresEvaluados,
      candidatos_nuevos: nuevos,
      candidatos_actualizados: actualizados,
      candidatos_respetados: respetados,
      candidatos_eliminados: eliminados,
      total_pendientes: Number(pend?.total ?? 0),
    };

    // Auditoría posterior al commit. Si falla, la detección ya es efectiva.
    try {
      await this.usuariosService.registrarAccion(
        idAdmin,
        'detectar_duplicados',
        `Ejecutó la detección de duplicados: ${nuevos} candidato(s) nuevo(s), ${resumen.total_pendientes} pendiente(s)`,
        'duplicados',
      );
    } catch (err) {
      this.logger.error(
        'Detección de duplicados aplicada pero falló el registro de auditoría',
        err instanceof Error ? err.stack : String(err),
      );
    }

    return resumen;
  }

  // 2. LISTAR, agrupado en casos (componentes conectados de los pares).
  async listar(query: ListarDuplicadosDto) {
    const estado = query.estado ?? 'pendiente';
    const limit = query.limit ?? LIMIT_DEFAULT;
    const offset = query.offset ?? 0;

    const condiciones = ['dc.estado = ?'];
    const params: (string | number)[] = [estado];
    if (query.carrera) {
      condiciones.push('(ca.nombre_carrera = ? OR cb.nombre_carrera = ?)');
      params.push(query.carrera, query.carrera);
    }

    const filas: any[] = await this.dataSource.query(`
      SELECT dc.id_candidato, dc.id_egresado_a, dc.id_egresado_b, dc.score,
             dc.coincide_num_control, dc.coincide_correo, dc.coincide_telefono,
             dc.coincide_nombre, dc.coincide_carrera, dc.similitud_nombre,
             dc.diferencia_anios, dc.estado, dc.detectado_en,
             dc.revisado_por, dc.revisado_en, dc.notas
      FROM duplicados_candidatos dc
      JOIN egresados ea ON ea.id_egresado = dc.id_egresado_a
      JOIN egresados eb ON eb.id_egresado = dc.id_egresado_b
      LEFT JOIN carreras ca ON ca.id_carrera = ea.carrera_id
      LEFT JOIN carreras cb ON cb.id_carrera = eb.carrera_id
      WHERE ${condiciones.join(' AND ')}
      ORDER BY dc.score DESC, dc.id_candidato
    `, params);

    const candidatos = filas.map(f => ({
      id_candidato: Number(f.id_candidato),
      id_egresado_a: Number(f.id_egresado_a),
      id_egresado_b: Number(f.id_egresado_b),
      score: Number(f.score),
      senales: this.etiquetasSenales(f),
      coincide_num_control: Number(f.coincide_num_control) === 1,
      coincide_correo: Number(f.coincide_correo) === 1,
      coincide_telefono: Number(f.coincide_telefono) === 1,
      coincide_nombre: Number(f.coincide_nombre) === 1,
      coincide_carrera: Number(f.coincide_carrera) === 1,
      similitud_nombre: Number(f.similitud_nombre),
      diferencia_anios: f.diferencia_anios === null ? null : Number(f.diferencia_anios),
      estado: f.estado as EstadoCandidato,
      detectado_en: f.detectado_en,
      revisado_por: f.revisado_por ?? null,
      revisado_en: f.revisado_en ?? null,
      notas: f.notas ?? null,
    }));

    // Componentes conectados (union-find): A~B, B~C y A~C son un solo caso.
    const padre = new Map<number, number>();
    const raiz = (x: number): number => {
      let r = x;
      while (padre.get(r) !== r) r = padre.get(r)!;
      while (padre.get(x) !== r) { const sig = padre.get(x)!; padre.set(x, r); x = sig; }
      return r;
    };
    for (const c of candidatos) {
      if (!padre.has(c.id_egresado_a)) padre.set(c.id_egresado_a, c.id_egresado_a);
      if (!padre.has(c.id_egresado_b)) padre.set(c.id_egresado_b, c.id_egresado_b);
      const ra = raiz(c.id_egresado_a);
      const rb = raiz(c.id_egresado_b);
      if (ra !== rb) padre.set(Math.max(ra, rb), Math.min(ra, rb));
    }

    const porRaiz = new Map<number, { ids: Set<number>; candidatos: typeof candidatos }>();
    for (const c of candidatos) {
      const r = raiz(c.id_egresado_a);
      if (!porRaiz.has(r)) porRaiz.set(r, { ids: new Set(), candidatos: [] });
      const g = porRaiz.get(r)!;
      g.ids.add(c.id_egresado_a);
      g.ids.add(c.id_egresado_b);
      g.candidatos.push(c); // ya vienen por score DESC
    }

    const todosLosGrupos = [...porRaiz.values()]
      .map(g => ({
        ids: [...g.ids].sort((x, y) => x - y),
        score_max: Math.max(...g.candidatos.map(c => c.score)),
        candidatos: g.candidatos,
      }))
      .sort((x, y) => y.score_max - x.score_max || x.ids[0] - y.ids[0]);

    const total = todosLosGrupos.length;
    const pagina = todosLosGrupos.slice(offset, offset + limit);

    // Datos de los egresados de la página, en una sola consulta.
    const idsPagina = [...new Set(pagina.flatMap(g => g.ids))];
    const porId = new Map<number, any>();
    if (idsPagina.length > 0) {
      const egresados: any[] = await this.dataSource.query(`
        SELECT e.id_egresado, e.nombre_completo, e.correo, e.telefono,
               e.numero_control, c.nombre_carrera, e.anio_ingreso, e.anio_egreso,
               e.fecha_registro, e.registro_completo, e.revisado
        FROM egresados e
        LEFT JOIN carreras c ON c.id_carrera = e.carrera_id
        WHERE e.id_egresado IN (?)
      `, [idsPagina]);
      for (const e of egresados) {
        porId.set(Number(e.id_egresado), {
          id_egresado: Number(e.id_egresado),
          nombre_completo: e.nombre_completo,
          correo: e.correo,
          telefono: e.telefono,
          numero_control: e.numero_control,
          nombre_carrera: e.nombre_carrera ?? null,
          anio_ingreso: e.anio_ingreso === null ? null : Number(e.anio_ingreso),
          anio_egreso: e.anio_egreso === null ? null : Number(e.anio_egreso),
          fecha_registro: e.fecha_registro,
          registro_completo: Number(e.registro_completo) === 1,
          revisado: Number(e.revisado) === 1,
        });
      }
    }

    const grupos = pagina.map(g => ({
      ids: g.ids,
      score_max: g.score_max,
      candidatos: g.candidatos.map(c => ({
        ...c,
        egresado_a: porId.get(c.id_egresado_a) ?? null,
        egresado_b: porId.get(c.id_egresado_b) ?? null,
      })),
      egresados: g.ids.map(id => porId.get(id)).filter(Boolean),
    }));

    return { grupos, total };
  }

  // 3. DESCARTAR — son personas distintas. No borra nada: el par solo deja
  // de aparecer en la lista de pendientes y el detector ya no lo reactiva.
  async descartar(id: number, revisadoPor: string, idAdmin: number, notas?: string) {
    const qr = this.dataSource.createQueryRunner();
    await qr.connect();
    await qr.startTransaction();
    let candidato: any;
    try {
      [candidato] = await qr.query(
        `SELECT id_candidato, id_egresado_a, id_egresado_b, estado
         FROM duplicados_candidatos
         WHERE id_candidato = ? FOR UPDATE`,
        [id],
      );
      if (!candidato) throw new NotFoundException('Candidato a duplicado no encontrado.');
      if (candidato.estado === 'descartado') {
        throw new ConflictException('Este par ya estaba descartado como duplicado.');
      }

      await qr.query(
        `UPDATE duplicados_candidatos
         SET estado = 'descartado', revisado_por = ?, revisado_en = NOW(), notas = ?
         WHERE id_candidato = ?`,
        [revisadoPor, notas?.trim() || null, id],
      );
      await qr.commitTransaction();
    } catch (err) {
      if (qr.isTransactionActive) await qr.rollbackTransaction();
      throw err;
    } finally {
      await qr.release();
    }

    try {
      await this.usuariosService.registrarAccion(
        idAdmin,
        'descartar_duplicado',
        `Descartó como duplicado el par de egresados ${candidato.id_egresado_a} y ${candidato.id_egresado_b}`,
        'duplicados',
      );
    } catch (err) {
      this.logger.error(
        `Candidato ${id} descartado pero falló el registro de auditoría`,
        err instanceof Error ? err.stack : String(err),
      );
    }

    return { mensaje: 'Par descartado: no se trata de un duplicado.', id_candidato: id };
  }

  // 4. RESUMEN para los KPIs del panel.
  // egresados_involucrados = egresados distintos que aparecen en algún par
  // PENDIENTE (los que todavía hay que revisar).
  async getResumen() {
    const [fila] = await this.dataSource.query(`
      SELECT
        SUM(estado = 'pendiente')  AS pendientes,
        SUM(estado = 'confirmado') AS confirmados,
        SUM(estado = 'descartado') AS descartados,
        MAX(detectado_en)          AS ultima_deteccion
      FROM duplicados_candidatos
    `);
    const [inv] = await this.dataSource.query(`
      SELECT COUNT(*) AS total FROM (
        SELECT id_egresado_a AS id FROM duplicados_candidatos WHERE estado = 'pendiente'
        UNION
        SELECT id_egresado_b AS id FROM duplicados_candidatos WHERE estado = 'pendiente'
      ) t
    `);

    // SUM() sobre una tabla vacía devuelve NULL, de ahí el ?? 0.
    return {
      pendientes: Number(fila?.pendientes ?? 0),
      confirmados: Number(fila?.confirmados ?? 0),
      descartados: Number(fila?.descartados ?? 0),
      egresados_involucrados: Number(inv?.total ?? 0),
      ultima_deteccion: fila?.ultima_deteccion ?? null,
    };
  }

  // 5. FUSIONAR — la operación más delicada del sistema: mueve hijos de uno o
  // más egresados al conservado y luego los BORRA. Todo el grupo va en una
  // sola transacción: o se fusiona completo o no se toca nada.
  async fusionar(dto: FusionarDuplicadosDto, fusionadoPor: string, idAdmin: number) {
    const idConservado = dto.id_egresado_conservado;
    const idsEliminados = dto.ids_eliminados;

    // Validaciones que no necesitan la base.
    if (idsEliminados.includes(idConservado)) {
      throw new BadRequestException('El egresado conservado no puede estar también en ids_eliminados.');
    }
    if (new Set(idsEliminados).size !== idsEliminados.length) {
      throw new BadRequestException('ids_eliminados trae ids repetidos.');
    }

    const todos = [idConservado, ...idsEliminados];
    const notas = dto.notas?.trim() || null;
    const resultados: {
      id_fusion: number;
      id_egresado_eliminado: number;
      id_candidato: number;
      hijos_reasignados: Record<string, number>;
      hijos_no_movidos: Record<string, number>;
      campos_completados: Record<string, unknown>;
    }[] = [];

    const qr = this.dataSource.createQueryRunner();
    await qr.connect();
    await qr.startTransaction();
    try {
      // PASO A — Bloquear las filas de TODOS los involucrados de una vez, en
      // orden de PK, antes de validar nada: dos administradores fusionando el
      // mismo grupo al mismo tiempo se forman en fila aquí.
      const bloqueadas: { id_egresado: number; registro_completo: number }[] = await qr.query(
        `SELECT id_egresado, registro_completo FROM egresados
         WHERE id_egresado IN (?)
         ORDER BY id_egresado
         FOR UPDATE`,
        [todos],
      );
      const existentes = new Set(bloqueadas.map(f => Number(f.id_egresado)));
      const faltantes = todos.filter(id => !existentes.has(id));
      if (faltantes.length > 0) {
        throw new BadRequestException(`No existen los egresados: ${faltantes.join(', ')}.`);
      }

      // Cada eliminado debe estar conectado con el conservado por pares que el
      // detector propuso (pendiente o confirmado), directa o transitivamente,
      // usando SOLO los ids de esta petición. Nadie puede borrar un egresado
      // arbitrario pasándolo por aquí. De paso se guarda el id_candidato que
      // une a cada eliminado ANTES de que la cascada del paso F lo borre.
      const candidatoPorEliminado = await this.validarConexion(qr, idConservado, idsEliminados);

      // registro_completo del conservado solo se reevalúa si ALGÚN eliminado
      // del grupo estaba completo (traía datos de etapa 2).
      const algunEliminadoCompleto = bloqueadas.some(
        f => idsEliminados.includes(Number(f.id_egresado)) && Number(f.registro_completo) === 1,
      );

      for (const idEliminado of idsEliminados) {
        resultados.push(await this.fusionarUno(
          qr, idConservado, idEliminado, candidatoPorEliminado.get(idEliminado)!, fusionadoPor, notas,
          algunEliminadoCompleto,
        ));
      }

      // PASO G
      await qr.commitTransaction();
    } catch (err) {
      if (qr.isTransactionActive) await qr.rollbackTransaction();
      throw err;
    } finally {
      await qr.release();
    }

    // Auditoría posterior al commit. Si falla, la fusión ya es efectiva.
    try {
      await this.usuariosService.registrarAccion(
        idAdmin,
        'fusionar_duplicados',
        `Fusionó los egresados ${idsEliminados.join(', ')} en el egresado ${idConservado}`,
        'duplicados',
      );
    } catch (err) {
      this.logger.error(
        `Fusión en ${idConservado} aplicada pero falló el registro de auditoría`,
        err instanceof Error ? err.stack : String(err),
      );
    }

    return {
      mensaje: `Se fusionaron ${idsEliminados.length} registro(s) en el egresado ${idConservado}.`,
      id_egresado_conservado: idConservado,
      fusiones: resultados,
    };
  }

  // BFS sobre los pares pendiente/confirmado cuyos DOS extremos están en la
  // petición. Devuelve, por cada eliminado, el id_candidato de la arista con
  // la que se alcanzó (la directa con el conservado si existe).
  private async validarConexion(qr: QueryRunner, idConservado: number, idsEliminados: number[]) {
    const ids = [idConservado, ...idsEliminados];
    const aristas: any[] = await qr.query(
      `SELECT id_candidato, id_egresado_a, id_egresado_b
       FROM duplicados_candidatos
       WHERE estado IN ('pendiente', 'confirmado')
         AND id_egresado_a IN (?) AND id_egresado_b IN (?)
       ORDER BY id_candidato
       FOR UPDATE`,
      [ids, ids],
    );

    const vecinos = new Map<number, { id: number; id_candidato: number }[]>();
    for (const a of aristas) {
      const x = Number(a.id_egresado_a);
      const y = Number(a.id_egresado_b);
      const idCand = Number(a.id_candidato);
      if (!vecinos.has(x)) vecinos.set(x, []);
      if (!vecinos.has(y)) vecinos.set(y, []);
      vecinos.get(x)!.push({ id: y, id_candidato: idCand });
      vecinos.get(y)!.push({ id: x, id_candidato: idCand });
    }

    const candidatoPor = new Map<number, number>();
    const visitados = new Set([idConservado]);
    const cola = [idConservado];
    while (cola.length > 0) {
      const actual = cola.shift()!;
      for (const v of vecinos.get(actual) ?? []) {
        if (visitados.has(v.id)) continue;
        visitados.add(v.id);
        candidatoPor.set(v.id, v.id_candidato);
        cola.push(v.id);
      }
    }

    const sinConexion = idsEliminados.filter(id => !visitados.has(id));
    if (sinConexion.length > 0) {
      throw new BadRequestException(
        `Los egresados ${sinConexion.join(', ')} no están propuestos como duplicados del egresado `
        + `${idConservado} (se requiere un par pendiente o confirmado que los una). No se fusionó nada.`,
      );
    }
    return candidatoPor;
  }

  // Pasos B a F para UN eliminado. Corre dentro de la transacción de fusionar.
  private async fusionarUno(
    qr: QueryRunner,
    idConservado: number,
    idEliminado: number,
    idCandidato: number,
    fusionadoPor: string,
    notas: string | null,
    algunEliminadoCompleto: boolean,
  ) {
    // Se relee el conservado en cada vuelta: un eliminado anterior del mismo
    // grupo pudo haberle rellenado campos.
    const [conservado] = await qr.query(`SELECT * FROM egresados WHERE id_egresado = ?`, [idConservado]);
    const [eliminado] = await qr.query(`SELECT * FROM egresados WHERE id_egresado = ?`, [idEliminado]);

    // PASO B — Snapshot completo ANTES de mover o borrar nada.
    const hijos: Record<string, any[]> = {};
    for (const t of TABLAS_HIJAS) {
      hijos[t.tabla] = await qr.query(`SELECT * FROM ${t.tabla} WHERE ${t.columna} = ?`, [idEliminado]);
    }
    const snapshot = { egresado: eliminado, hijos };

    // PASO C — Rellenar SOLO lo vacío del conservado. Nunca se sobrescribe.
    const camposCompletados: Record<string, unknown> = {};
    const final: Record<string, unknown> = { ...conservado };
    for (const campo of CAMPOS_RELLENABLES) {
      if (!vacio(conservado[campo]) || vacio(eliminado[campo])) continue;
      const gobernante = DEPENDE_DE[campo];
      if (gobernante && final[gobernante] !== eliminado[gobernante]) continue;
      camposCompletados[campo] = eliminado[campo];
      final[campo] = eliminado[campo];
    }
    const aRellenar = Object.keys(camposCompletados);
    if (aRellenar.length > 0) {
      await qr.query(
        `UPDATE egresados SET ${aRellenar.map(c => `${c} = ?`).join(', ')} WHERE id_egresado = ?`,
        [...aRellenar.map(c => camposCompletados[c]), idConservado],
      );
    }

    // PASO D — Reasignar hijos. Con unicoPor, solo se mueven las filas cuyo
    // equivalente NO existe ya en el conservado (el LEFT JOIN las detecta);
    // las que chocan se quedan y mueren con el borrado del paso F.
    const hijosReasignados: Record<string, number> = {};
    const hijosNoMovidos: Record<string, number> = {};
    for (const t of TABLAS_HIJAS) {
      let res: any;
      if (!t.unicoPor) {
        res = await qr.query(
          `UPDATE ${t.tabla} SET ${t.columna} = ? WHERE ${t.columna} = ?`,
          [idConservado, idEliminado],
        );
      } else {
        const otras = t.unicoPor.filter(c => c !== t.columna);
        const on = [`c.${t.columna} = ?`, ...otras.map(c => `c.${c} <=> h.${c}`)].join(' AND ');
        res = await qr.query(
          `UPDATE ${t.tabla} AS h
           LEFT JOIN ${t.tabla} AS c ON ${on}
           SET h.${t.columna} = ?
           WHERE h.${t.columna} = ? AND c.${t.columna} IS NULL`,
          [idConservado, idConservado, idEliminado],
        );
      }
      const movidas = Number(res?.affectedRows ?? 0);
      hijosReasignados[t.tabla] = movidas;
      hijosNoMovidos[t.tabla] = hijos[t.tabla].length - movidas;
    }

    // Consentimiento de datos sensibles: si se movieron filas sensibles del
    // eliminado (que sí consintió) a un conservado que no consintió, el
    // consentimiento viaja con ellas. Nunca se inventa: sale del eliminado.
    const sensiblesMovidas = TABLAS_SENSIBLES.reduce((s, t) => s + (hijosReasignados[t] ?? 0), 0);
    if (sensiblesMovidas > 0
      && Number(conservado.consintio_datos_sensibles) !== 1
      && Number(eliminado.consintio_datos_sensibles) === 1) {
      await qr.query(
        `UPDATE egresados
         SET consintio_datos_sensibles = 1, fecha_consentimiento_sensibles = ?
         WHERE id_egresado = ?`,
        [eliminado.fecha_consentimiento_sensibles, idConservado],
      );
      camposCompletados.consintio_datos_sensibles = 1;
      camposCompletados.fecha_consentimiento_sensibles = eliminado.fecha_consentimiento_sensibles;
    }

    // Autorizaciones: si ambos tenían fila, la del conservado se quedó (paso
    // D); ahora sus permisos toman el valor MÁS RESTRICTIVO de los dos.
    Object.assign(camposCompletados,
      await this.combinarAutorizaciones(qr, idConservado, hijos.autorizaciones));

    // registro_completo: se recalcula con la MISMA regla de la etapa 2 (va
    // después del paso D porque esa regla también mira habilidades y
    // colaboraciones). Solo sube a 1 si el resultado de verdad cumple; nunca
    // se fuerza.
    if (algunEliminadoCompleto) {
      const [actual] = await qr.query(
        `SELECT registro_completo FROM egresados WHERE id_egresado = ?`, [idConservado],
      );
      if (Number(actual.registro_completo) !== 1 && await this.cumpleEtapa2(qr, idConservado)) {
        await qr.query(`UPDATE egresados SET registro_completo = 1 WHERE id_egresado = ?`, [idConservado]);
        camposCompletados.registro_completo = '0 -> 1';
      }
    }

    // Fusiones anteriores donde el eliminado era el conservado: se re-apuntan
    // al nuevo sobreviviente para no perder la cadena (la FK las pondría en NULL).
    await qr.query(
      `UPDATE duplicados_fusiones SET id_egresado_conservado = ? WHERE id_egresado_conservado = ?`,
      [idConservado, idEliminado],
    );

    // PASO E — Bitácora, TODAVÍA antes del borrado.
    const insert = await qr.query(
      `INSERT INTO duplicados_fusiones
         (id_egresado_conservado, id_egresado_eliminado,
          nombre_eliminado, correo_eliminado, numero_control_eliminado,
          snapshot, hijos_reasignados, campos_completados,
          id_candidato, fusionado_por, notas)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        idConservado, idEliminado,
        eliminado.nombre_completo, eliminado.correo, eliminado.numero_control ?? '',
        JSON.stringify(snapshot),
        JSON.stringify(hijosReasignados),
        JSON.stringify(camposCompletados),
        idCandidato, fusionadoPor, notas,
      ],
    );

    // PASO F — Borrar. La cascada se lleva los hijos que no se movieron y los
    // pares de duplicados_candidatos donde aparecía el eliminado.
    const borrado = await qr.query(`DELETE FROM egresados WHERE id_egresado = ?`, [idEliminado]);
    if (Number(borrado?.affectedRows ?? 0) !== 1) {
      throw new ConflictException(`No se pudo borrar el egresado ${idEliminado}. No se fusionó nada.`);
    }

    return {
      id_fusion: Number(insert.insertId),
      id_egresado_eliminado: idEliminado,
      id_candidato: idCandidato,
      hijos_reasignados: hijosReasignados,
      hijos_no_movidos: hijosNoMovidos,
      campos_completados: camposCompletados,
    };
  }

  // REGLA DELIBERADA — NO "ARREGLAR": en autorizaciones gana la respuesta MÁS
  // RESTRICTIVA, no la del conservado ni la más reciente. Es la misma persona
  // contestando dos veces; si dijo "no" aunque fuera una sola vez, se respeta
  // el no (postura segura frente a la LFPDPPP).
  //   · Queda en 1 solo si TODAS las filas involucradas tienen 1.
  //   · Si alguna tiene 0, queda en 0.
  //   · Si no hay ningún 0 pero falta alguna respuesta (NULL), queda NULL:
  //     no hay consentimiento registrado, y tampoco se inventa un "no".
  // Solo aplica a las columnas de PERMISOS_AUTORIZACION; nunca a la PK ni a
  // id_egresado. Devuelve los permisos que cambiaron, para la bitácora.
  private async combinarAutorizaciones(qr: QueryRunner, idConservado: number, filasEliminado: any[]) {
    const cambios: Record<string, string> = {};
    const filasConservado: any[] = await qr.query(
      `SELECT * FROM autorizaciones WHERE id_egresado = ?`, [idConservado],
    );
    if (filasConservado.length === 0 || filasEliminado.length === 0) return cambios;

    const todas = [...filasConservado, ...filasEliminado];
    const nuevos: Record<string, number | null> = {};
    for (const p of PERMISOS_AUTORIZACION) {
      const valores = todas.map(f => (f[p] === null || f[p] === undefined ? null : Number(f[p])));
      const resultado = valores.every(v => v === 1) ? 1 : valores.some(v => v === 0) ? 0 : null;
      for (const f of filasConservado) {
        const antes = f[p] === null || f[p] === undefined ? null : Number(f[p]);
        if (antes !== resultado) {
          nuevos[p] = resultado;
          cambios[`autorizaciones.${p}`] = `${antes} -> ${resultado}`;
        }
      }
    }

    const cols = Object.keys(nuevos);
    if (cols.length > 0) {
      await qr.query(
        `UPDATE autorizaciones SET ${cols.map(c => `${c} = ?`).join(', ')} WHERE id_egresado = ?`,
        [...cols.map(c => nuevos[c]), idConservado],
      );
    }
    return cambios;
  }

  // ¿El conservado ya cumple la etapa 2? El sistema no tiene otra regla de
  // "registro completo" que esta: completarEtapa2 pone registro_completo = 1
  // cuando la petición pasa la validación de CreateEgresadoEtapa2Dto. Por eso
  // se valida el registro fusionado contra ESE MISMO DTO, con las mismas
  // opciones que el ValidationPipe global: una sola fuente de verdad. Si el
  // DTO cambia, la fusión lo sigue sola.
  private async cumpleEtapa2(qr: QueryRunner, idEgresado: number): Promise<boolean> {
    const [e] = await qr.query(
      `SELECT e.correo, e.nombre_completo, e.numero_control, e.linkedin, cl.nivel AS coincidencia_laboral
       FROM egresados e
       LEFT JOIN coincidencia_laboral cl ON cl.id_coincidencia = e.coincidencia_laboral_id
       WHERE e.id_egresado = ?`,
      [idEgresado],
    );
    const habilidades: any[] = await qr.query(
      `SELECT h.habilidad FROM egresado_habilidades eh
       JOIN habilidades h ON h.id_habilidad = eh.id_habilidad
       WHERE eh.id_egresado = ?`,
      [idEgresado],
    );
    const colaboraciones: any[] = await qr.query(
      `SELECT c.descripcion FROM egresado_colaboraciones ec
       JOIN colaboraciones c ON c.id_colaboracion = ec.id_colaboracion
       WHERE ec.id_egresado = ?`,
      [idEgresado],
    );

    const datos: Record<string, unknown> = {
      correo: e.correo,
      nombre_completo: e.nombre_completo,
      numero_control: e.numero_control,
      coincidencia_laboral: e.coincidencia_laboral ?? undefined,
      habilidades: habilidades.map(h => h.habilidad),
      colaboraciones: colaboraciones.map(c => c.descripcion),
    };
    if (!vacio(e.linkedin)) datos.linkedin = e.linkedin;

    const errores = await validate(plainToInstance(CreateEgresadoEtapa2Dto, datos), {
      whitelist: true,
      forbidNonWhitelisted: true,
    });
    return errores.length === 0;
  }

  // 6. HISTORIAL de fusiones. Sin snapshot: es pesado (ver getFusion).
  async listarFusiones(query: ListarFusionesDto) {
    const limit = query.limit ?? LIMIT_DEFAULT;
    const offset = query.offset ?? 0;

    const [conteo] = await this.dataSource.query(`SELECT COUNT(*) AS total FROM duplicados_fusiones`);
    const filas: any[] = await this.dataSource.query(`
      SELECT f.id_fusion, f.id_egresado_conservado, e.nombre_completo AS nombre_conservado,
             f.id_egresado_eliminado, f.nombre_eliminado, f.correo_eliminado,
             f.numero_control_eliminado, f.hijos_reasignados, f.campos_completados,
             f.id_candidato, f.fusionado_por, f.fusionado_en, f.notas
      FROM duplicados_fusiones f
      LEFT JOIN egresados e ON e.id_egresado = f.id_egresado_conservado
      ORDER BY f.fusionado_en DESC, f.id_fusion DESC
      LIMIT ? OFFSET ?
    `, [limit, offset]);

    return {
      fusiones: filas.map(f => this.mapearFusion(f)),
      total: Number(conteo?.total ?? 0),
    };
  }

  // 7. DETALLE de una fusión, con el snapshot completo del eliminado.
  async getFusion(id: number) {
    const [f] = await this.dataSource.query(`
      SELECT f.id_fusion, f.id_egresado_conservado, e.nombre_completo AS nombre_conservado,
             f.id_egresado_eliminado, f.nombre_eliminado, f.correo_eliminado,
             f.numero_control_eliminado, f.hijos_reasignados, f.campos_completados,
             f.id_candidato, f.fusionado_por, f.fusionado_en, f.notas, f.snapshot
      FROM duplicados_fusiones f
      LEFT JOIN egresados e ON e.id_egresado = f.id_egresado_conservado
      WHERE f.id_fusion = ?
    `, [id]);
    if (!f) throw new NotFoundException('Fusión no encontrada.');
    return { ...this.mapearFusion(f), snapshot: leerJson(f.snapshot) };
  }

  private mapearFusion(f: any) {
    return {
      id_fusion: Number(f.id_fusion),
      id_egresado_conservado: f.id_egresado_conservado === null ? null : Number(f.id_egresado_conservado),
      nombre_conservado: f.nombre_conservado ?? null,
      id_egresado_eliminado: Number(f.id_egresado_eliminado),
      nombre_eliminado: f.nombre_eliminado,
      correo_eliminado: f.correo_eliminado,
      numero_control_eliminado: f.numero_control_eliminado,
      hijos_reasignados: numerosPorClave(f.hijos_reasignados),
      campos_completados: leerJson(f.campos_completados),
      id_candidato: f.id_candidato === null ? null : Number(f.id_candidato),
      fusionado_por: f.fusionado_por ?? null,
      fusionado_en: f.fusionado_en,
      notas: f.notas ?? null,
    };
  }
}
