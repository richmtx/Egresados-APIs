import { Injectable, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, QueryRunner } from 'typeorm';
import { unlink } from 'fs/promises';
import { join } from 'path';

import { Egresado } from './egresados.entity';
import { CreateEgresadoEtapa1Dto } from './dto/create-egresado-etapa1.dto';
import { CreateEgresadoEtapa2Dto } from './dto/create-egresado-etapa2.dto';
import { NotificacionesService } from '../notificaciones/notificaciones.service';

interface IdentidadResuelta {
  id_indigena: number;
  id_habla_lengua: number;
  lengua_indigena: string | null;
  id_afromexicano: number;
}

interface DatosSensiblesResueltos {
  discapacidad: { id_dominio: number; id_grado: number }[];
  identidad: IdentidadResuelta | null;
}

interface TrayectoriaResuelta {
  estudios: {
    id_nivel_estudio: number; nombre_programa: string; institucion: string;
    id_estado_estudio: number; anio: number | null;
  }[];
  emprendimientos: {
    nombre: string; giro: string; anio_inicio: number | null;
    sigue_operando: number; id_rango_empleados: number | null;
  }[];
  proyectos_sociales: {
    nombre: string; id_tipo_proyecto: number; anio: number | null;
    organizacion: string | null;
  }[];
}

@Injectable()
export class EgresadosService {

  constructor(
    @InjectRepository(Egresado)
    private egresadosRepo: Repository<Egresado>,
    private dataSource: DataSource,
    private notificacionesService: NotificacionesService,
  ) { }

  // Borra un egresado y TODOS sus registros hijos. Lo usan la limpieza de
  // registros incompletos (candado) y el remove de vinculación.
  // `exec` permite correrlo dentro de una transacción (QueryRunner); por
  // defecto usa el DataSource.
  private async borrarEgresadoCompleto(
    id: number,
    exec: QueryRunner | DataSource = this.dataSource,
  ): Promise<void> {
    await exec.query(`DELETE FROM autorizaciones          WHERE id_egresado = ?`, [id]);
    await exec.query(`DELETE FROM certificaciones         WHERE id_egresado = ?`, [id]);
    await exec.query(`DELETE FROM egresado_habilidades    WHERE id_egresado = ?`, [id]);
    await exec.query(`DELETE FROM habilidades_otro        WHERE id_egresado = ?`, [id]);
    await exec.query(`DELETE FROM egresado_colaboraciones WHERE id_egresado = ?`, [id]);
    await exec.query(`DELETE FROM colaboracion_otro       WHERE id_egresado = ?`, [id]);
    // Datos sensibles de inclusión: se borran de forma explícita, sin depender
    // solo del ON DELETE CASCADE, para que nunca sobrevivan a su egresado.
    await exec.query(`DELETE FROM egresado_discapacidad   WHERE id_egresado = ?`, [id]);
    await exec.query(`DELETE FROM egresado_identidad      WHERE id_egresado = ?`, [id]);
    // Trayectoria profesional: también explícito, sin depender solo del CASCADE.
    await exec.query(`DELETE FROM egresado_estudios           WHERE id_egresado = ?`, [id]);
    await exec.query(`DELETE FROM egresado_emprendimientos    WHERE id_egresado = ?`, [id]);
    await exec.query(`DELETE FROM egresado_proyectos_sociales WHERE id_egresado = ?`, [id]);
    await exec.query(`DELETE FROM notificaciones          WHERE id_egresado = ?`, [id]);
    await exec.query(`DELETE FROM egresados               WHERE id_egresado = ?`, [id]);
  }

  // Resuelve las claves de discapacidad/identidad a ids de catálogo.
  //
  // PUERTA DE CONSENTIMIENTO: si el egresado no consintió de forma explícita
  // (=== true), devuelve null y los datos sensibles del DTO se ignoran por
  // completo (ni se validan ni se guardan). Solo lee catálogos; no escribe.
  private async resolverDatosSensibles(
    dto: CreateEgresadoEtapa1Dto,
  ): Promise<DatosSensiblesResueltos | null> {
    if (dto.consintio_datos_sensibles !== true) return null;

    const mapaClaves = async (tabla: string, colId: string): Promise<Map<string, number>> => {
      const rows = await this.dataSource.query(`SELECT ${colId}, clave FROM ${tabla}`);
      return new Map(rows.map((r: any) => [r.clave, r[colId]]));
    };

    const discapacidad: { id_dominio: number; id_grado: number }[] = [];
    if (dto.discapacidad?.length) {
      const dominios = await mapaClaves('discapacidad_dominios', 'id_dominio');
      const grados = await mapaClaves('grados_dificultad', 'id_grado');
      const vistos = new Set<string>();

      for (const item of dto.discapacidad) {
        const id_dominio = dominios.get(item.dominio);
        if (id_dominio === undefined) {
          throw new BadRequestException(
            `Dominio de discapacidad no válido: "${item.dominio}".`,
          );
        }
        const id_grado = grados.get(item.grado);
        if (id_grado === undefined) {
          throw new BadRequestException(
            `Grado de dificultad no válido: "${item.grado}".`,
          );
        }
        if (vistos.has(item.dominio)) {
          throw new BadRequestException(
            `El dominio de discapacidad "${item.dominio}" viene repetido.`,
          );
        }
        vistos.add(item.dominio);
        discapacidad.push({ id_dominio, id_grado });
      }
    }

    let identidad: IdentidadResuelta | null = null;
    if (dto.identidad) {
      const respuestas = await mapaClaves('respuestas_autoadscripcion', 'id_respuesta');
      const resolver = (campo: string, clave: string): number => {
        const id = respuestas.get(clave);
        if (id === undefined) {
          throw new BadRequestException(
            `Respuesta de autoadscripción no válida en "${campo}": "${clave}".`,
          );
        }
        return id;
      };

      const habla = dto.identidad.habla_lengua;
      identidad = {
        id_indigena: resolver('indigena', dto.identidad.indigena),
        id_habla_lengua: resolver('habla_lengua', habla),
        // La lengua solo se conserva si respondió 'si' a hablar una lengua
        lengua_indigena: habla === 'si' ? (dto.identidad.lengua_indigena?.trim() || null) : null,
        id_afromexicano: resolver('afromexicano', dto.identidad.afromexicano),
      };
    }

    return { discapacidad, identidad };
  }

  // Resuelve las claves de estudios / emprendimientos / proyectos sociales a
  // ids de catálogo. Son datos profesionales normales: no hay puerta de
  // consentimiento. Solo lee catálogos; no escribe. Devuelve null si no viene
  // ningún elemento en los tres arreglos.
  private async resolverTrayectoria(
    dto: CreateEgresadoEtapa1Dto,
  ): Promise<TrayectoriaResuelta | null> {
    if (!dto.estudios?.length && !dto.emprendimientos?.length && !dto.proyectos_sociales?.length) {
      return null;
    }

    const mapaClaves = async (tabla: string, colId: string): Promise<Map<string, number>> => {
      const rows = await this.dataSource.query(`SELECT ${colId}, clave FROM ${tabla}`);
      return new Map(rows.map((r: any) => [r.clave, r[colId]]));
    };

    const resolver = (mapa: Map<string, number>, catalogo: string, clave: string): number => {
      const id = mapa.get(clave);
      if (id === undefined) {
        throw new BadRequestException(
          `La clave "${clave}" no existe en el catálogo ${catalogo}.`,
        );
      }
      return id;
    };

    const estudios: TrayectoriaResuelta['estudios'] = [];
    if (dto.estudios?.length) {
      const niveles = await mapaClaves('niveles_estudio', 'id_nivel_estudio');
      const estados = await mapaClaves('estados_estudio', 'id_estado_estudio');
      for (const e of dto.estudios) {
        estudios.push({
          id_nivel_estudio: resolver(niveles, 'niveles_estudio', e.nivel),
          nombre_programa: e.nombre_programa.trim(),
          institucion: e.institucion.trim(),
          id_estado_estudio: resolver(estados, 'estados_estudio', e.estado),
          anio: e.anio ?? null,
        });
      }
    }

    const emprendimientos: TrayectoriaResuelta['emprendimientos'] = [];
    if (dto.emprendimientos?.length) {
      const rangos = await mapaClaves('rangos_empleados', 'id_rango_empleados');
      for (const e of dto.emprendimientos) {
        emprendimientos.push({
          nombre: e.nombre.trim(),
          giro: e.giro.trim(),
          anio_inicio: e.anio_inicio ?? null,
          // Por defecto sigue operando; solo un false explícito lo apaga
          sigue_operando: e.sigue_operando === false ? 0 : 1,
          id_rango_empleados: e.rango_empleados
            ? resolver(rangos, 'rangos_empleados', e.rango_empleados)
            : null,
        });
      }
    }

    const proyectos_sociales: TrayectoriaResuelta['proyectos_sociales'] = [];
    if (dto.proyectos_sociales?.length) {
      const tipos = await mapaClaves('tipos_proyecto_social', 'id_tipo_proyecto');
      for (const p of dto.proyectos_sociales) {
        proyectos_sociales.push({
          nombre: p.nombre.trim(),
          id_tipo_proyecto: resolver(tipos, 'tipos_proyecto_social', p.tipo),
          anio: p.anio ?? null,
          organizacion: p.organizacion?.trim() || null,
        });
      }
    }

    return { estudios, emprendimientos, proyectos_sociales };
  }

  private async resolveId(
    tabla: string,
    columnaId: string,
    columnaTexto: string,
    valor: string,
  ): Promise<number> {
    const rows = await this.dataSource.query(
      `SELECT ${columnaId} FROM ${tabla} WHERE ${columnaTexto} = ? LIMIT 1`,
      [valor],
    );
    if (!rows.length) {
      throw new BadRequestException(
        `Valor "${valor}" no encontrado en la tabla ${tabla}.`,
      );
    }
    return rows[0][columnaId];
  }

  /**
 * Determina si el egresado reside fuera de México (en el extranjero),
 * a partir del texto libre de ciudad_residencia.
 *
 * Estrategia conservadora:
 *  1. Si menciona México explícitamente → residencia nacional.
 *  2. Si menciona un país/indicador extranjero conocido → extranjero.
 *  3. Si es ambiguo (sin país) → se asume nacional, para evitar falsos positivos.
 *
 * Ajusta las dos listas al formato real con el que tu formulario guarda la residencia.
 */
  private resideEnElExtranjero(ciudadResidencia: string): boolean {
    if (!ciudadResidencia || !ciudadResidencia.trim()) return false;

    const normalizar = (s: string) =>
      s.toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '') // quita acentos
        .trim();

    const texto = normalizar(ciudadResidencia);

    // 1. Indicadores de residencia nacional (México)
    const indicadoresMexico = ['mexico', ', mx', ' mx '];
    if (indicadoresMexico.some((t) => texto.includes(normalizar(t)))) {
      return false;
    }

    // 2. Indicadores de residencia en el extranjero (amplía según tus datos reales)
    const indicadoresExtranjero = [
      'estados unidos', 'united states', 'usa', 'ee.uu', 'eua',
      'canada', 'espana', 'spain', 'alemania', 'germany',
      'francia', 'france', 'reino unido', 'inglaterra',
      'china', 'japon', 'argentina', 'colombia', 'chile', 'peru', 'brasil',
    ];
    return indicadoresExtranjero.some((t) => texto.includes(normalizar(t)));
  }

  private async generarNotificacionDestacada(
    id_egresado: number,
    nombre: string,
    carrera: string,
    anio: number,
    ciudadTrabajo: string,        // nota: ya no se usa aquí (ver explicación abajo)
    ciudadResidencia: string,
    autorizoContacto: boolean,
    autorizoEventos: boolean,
  ): Promise<void> {

    const nombreCorto = nombre.split(' ').slice(0, 2).join(' ');

    // ── 1. UBICACIÓN (determinista) ─────────────────────────────────────────────
    // Si el egresado reside en el extranjero, SIEMPRE se crea, con su tipo propio
    // 'nueva_encuesta_ubicacion' (tag rojo "Ubicación" en el front). Fuera del sorteo.
    if (this.resideEnElExtranjero(ciudadResidencia)) {
      await this.notificacionesService.crear({
        tipo: 'nueva_encuesta_ubicacion',
        titulo: 'Encuesta destacada — Ubicación',
        descripcion: `${nombreCorto} reside actualmente en ${ciudadResidencia} y completó la encuesta (${carrera}, ${anio})`,
        id_egresado,
      });
    }

    // ── 2. DESTACADA (una al azar) ──────────────────────────────────────────────
    // Ya NO incluye la ubicación: esa se maneja arriba de forma independiente.
    const puestoRow = await this.dataSource.query(
      `SELECT puesto_trabajo FROM egresados WHERE id_egresado = ? LIMIT 1`,
      [id_egresado],
    );
    const puesto: string = puestoRow[0]?.puesto_trabajo || '';

    const opciones: { tipo: string; titulo: string; descripcion: string }[] = [];

    if (puesto && puesto.trim() !== '') {
      opciones.push({
        tipo: 'nueva_encuesta',
        titulo: 'Encuesta destacada — Puesto laboral',
        descripcion: `${nombreCorto}, ${puesto} completó la encuesta (${carrera}, ${anio})`,
      });
    }

    if (autorizoContacto) {
      opciones.push({
        tipo: 'contacto',
        titulo: 'Nuevo egresado disponible',
        descripcion: `${nombre} autorizó contacto para ofertas laborales — ${carrera}, generación ${anio}`,
      });
    }

    if (autorizoEventos) {
      opciones.push({
        tipo: 'eventos',
        titulo: 'Egresado disponible para eventos',
        descripcion: `${nombre} autorizó participar en actividades académicas y eventos institucionales`,
      });
    }

    if (opciones.length === 0) {
      opciones.push({
        tipo: 'nueva_encuesta',
        titulo: 'Nueva encuesta recibida',
        descripcion: `${nombre} completó la encuesta (${carrera}, ${anio})`,
      });
    }

    const elegida = opciones[Math.floor(Math.random() * opciones.length)];

    await this.notificacionesService.crear({
      tipo: elegida.tipo,
      titulo: elegida.titulo,
      descripcion: elegida.descripcion,
      id_egresado,
    });
  }

  // Crear Etapa 1
  async crearEtapa1(
    dto: CreateEgresadoEtapa1Dto,
    fotoUrl: string | null = null,
  ): Promise<{ id_egresado: number; mensaje: string }> {

    // Correo normalizado: minúsculas + sin espacios. Es la llave del candado.
    const correo = dto.correo.trim().toLowerCase();

    // ── CANDADO ─────────────────────────────────────────────────────────────
    const existente = await this.dataSource.query(
      `SELECT id_egresado, registro_completo
       FROM egresados WHERE correo = ? LIMIT 1`,
      [correo],
    );

    if (existente.length > 0) {
      if (existente[0].registro_completo) {
        // Ya terminó su registro → se activa el candado
        throw new ConflictException(
          'Ya tenemos registradas tus respuestas. Si necesitas corregir algún dato, comunícate con vinculación.',
        );
      }
      // Registro a medias del mismo correo → se limpia para empezar de cero,
      // pero DENTRO de la transacción de más abajo (si el nuevo insert falla,
      // el borrado se revierte y no se pierde el registro previo).
    }
    // ─────────────────────────────────────────────────────────────────────────

    const genero_id = await this.resolveId('generos', 'id_genero', 'genero', dto.genero);
    const carrera_id = await this.resolveId('carreras', 'id_carrera', 'nombre_carrera', dto.carrera);
    const nivel_ingles_id = await this.resolveId('niveles_ingles', 'id_nivel', 'nivel', dto.nivel_ingles);
    const situacion_laboral_id = await this.resolveId('situacion_laboral', 'id_situacion', 'situacion', dto.situacion_laboral);
    const antiguedad_empleo_id = dto.antiguedad_empleo
      ? await this.resolveId('antiguedad_empleo', 'id_antiguedad', 'rango', dto.antiguedad_empleo)
      : null;
    // Pregunta retirada del formulario público: opcional, NULL si no viene
    const certificacion_vigente_id = dto.certificacion_vigente?.trim()
      ? await this.resolveId('certificaciones_vigentes', 'id_certificacion_vigente', 'respuesta', dto.certificacion_vigente.trim())
      : null;

    // ── datos laborales actuales: NULL = no aplica / no respondió (nunca '') ──
    const empresa = dto.empresa?.trim() || null;
    const ciudadTrabajo = dto.ciudad_trabajo?.trim() || null;
    const puestoTrabajo = dto.puesto_trabajo?.trim() || null;

    // ── primer empleo ─────────────────────────────────────────────────────
    const sinEmpleo = dto.tiempo_primer_empleo === 'Aún no he conseguido empleo';

    const tiempo_primer_empleo_id = await this.resolveId('tiempo_primer_empleo', 'id_tiempo', 'rango', dto.tiempo_primer_empleo);

    // Si nunca se empleó, no hay medio → queda NULL
    const medio_primer_empleo_id = sinEmpleo
      ? null
      : await this.resolveId('medio_primer_empleo', 'id_medio', 'medio', dto.medio_primer_empleo!);

    const medioOtro = (!sinEmpleo && dto.medio_primer_empleo === 'Otra')
      ? (dto.medio_primer_empleo_otro?.trim() || '')
      : '';

    // Sin empleo no hay primer empleo → empresa y puesto quedan NULL aunque el DTO los traiga
    const primerEmpleoEmpresa = sinEmpleo ? null : (dto.primer_empleo_empresa?.trim() || null);
    const primerEmpleoPuesto = sinEmpleo ? null : (dto.primer_empleo_puesto?.trim() || null);

    // ── redes sociales (opcionales) ───────────────────────────────────────
    const facebook = dto.facebook?.trim() || '';
    const instagram = dto.instagram?.trim() || '';

    // El ingreso no puede ser posterior al egreso
    if (dto.anio_ingreso && dto.anio_ingreso > dto.anio_egreso) {
      throw new BadRequestException(
        'El año de ingreso no puede ser posterior al año de egreso.',
      );
    }

    // Datos sensibles: null si no hubo consentimiento explícito (se ignoran).
    // Se resuelve ANTES de abrir la transacción: una clave inválida lanza
    // BadRequestException sin haber escrito nada.
    const sensibles = await this.resolverDatosSensibles(dto);

    // Trayectoria profesional: misma idea, clave inválida → 400 sin escribir nada.
    const trayectoria = await this.resolverTrayectoria(dto);

    // Una sola transacción: egresado + autorizaciones + datos sensibles.
    // Si algo falla a medias, todo se revierte.
    const qr = this.dataSource.createQueryRunner();
    await qr.connect();
    await qr.startTransaction();

    // INSERT con red de seguridad por si dos registros entran al mismo tiempo
    let id_egresado: number;
    try {
      if (existente.length > 0) {
        await this.borrarEgresadoCompleto(existente[0].id_egresado, qr);
      }

      const result = await qr.query(
        `INSERT INTO egresados
      (nombre_completo, genero_id, correo, telefono, ciudad_residencia,
       pais_nacimiento,
       carrera_id, anio_ingreso, periodo_ingreso, anio_egreso,
       estatus_titulacion, certificacion_vigente_id,
       nivel_ingles_id, situacion_laboral_id, empresa, antiguedad_empleo_id,
       tiempo_primer_empleo_id, medio_primer_empleo_id, medio_primer_empleo_otro,
       primer_empleo_empresa, primer_empleo_puesto,
       ciudad_trabajo, satisfaccion_formacion, fecha_registro,
       numero_control, linkedin, facebook, instagram, puesto_trabajo,
       coincidencia_laboral_id, foto_url, registro_completo)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), '', NULL, ?, ?, ?, 1, ?, 0)`,
        [
          dto.nombre_completo,
          genero_id,
          correo,
          dto.telefono,
          dto.ciudad_residencia,
          dto.pais_nacimiento ?? null,
          carrera_id,
          dto.anio_ingreso ?? null,
          dto.periodo_ingreso ?? null,
          dto.anio_egreso,
          dto.estatus_titulacion,
          certificacion_vigente_id,
          nivel_ingles_id,
          situacion_laboral_id,
          empresa,
          antiguedad_empleo_id,
          tiempo_primer_empleo_id,
          medio_primer_empleo_id,
          medioOtro,
          primerEmpleoEmpresa,
          primerEmpleoPuesto,
          ciudadTrabajo,
          dto.satisfaccion_formacion,
          facebook,
          instagram,
          puestoTrabajo,
          fotoUrl,
        ],
      );
      id_egresado = result.insertId;

      await qr.query(
        `INSERT INTO autorizaciones
      (id_egresado, autorizo_estadisticas, autorizo_contacto, autorizo_eventos)
     VALUES (?, ?, ?, ?)`,
        [
          id_egresado,
          dto.autorizaciones.estadisticas ? 1 : 0,
          dto.autorizaciones.contacto ? 1 : 0,
          dto.autorizaciones.eventos ? 1 : 0,
        ],
      );

      // ── Datos sensibles (solo con consentimiento explícito) ───────────────
      // Sin consentimiento: no se toca nada; las columnas de consentimiento
      // conservan su default (0 / NULL) y no se crea NINGUNA fila en
      // egresado_discapacidad ni egresado_identidad.
      if (sensibles) {
        await qr.query(
          `UPDATE egresados
              SET consintio_datos_sensibles = 1,
                  fecha_consentimiento_sensibles = NOW()
            WHERE id_egresado = ?`,
          [id_egresado],
        );

        for (const d of sensibles.discapacidad) {
          await qr.query(
            `INSERT INTO egresado_discapacidad (id_egresado, id_dominio, id_grado)
             VALUES (?, ?, ?)`,
            [id_egresado, d.id_dominio, d.id_grado],
          );
        }

        if (sensibles.identidad) {
          const i = sensibles.identidad;
          await qr.query(
            `INSERT INTO egresado_identidad
               (id_egresado, id_indigena, id_habla_lengua, lengua_indigena, id_afromexicano)
             VALUES (?, ?, ?, ?, ?)`,
            [id_egresado, i.id_indigena, i.id_habla_lengua, i.lengua_indigena, i.id_afromexicano],
          );
        }
      }

      // ── Trayectoria profesional (datos normales, sin consentimiento) ──────
      if (trayectoria) {
        for (const e of trayectoria.estudios) {
          await qr.query(
            `INSERT INTO egresado_estudios
               (id_egresado, id_nivel_estudio, nombre_programa, institucion,
                id_estado_estudio, anio)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [id_egresado, e.id_nivel_estudio, e.nombre_programa, e.institucion,
              e.id_estado_estudio, e.anio],
          );
        }

        for (const e of trayectoria.emprendimientos) {
          await qr.query(
            `INSERT INTO egresado_emprendimientos
               (id_egresado, nombre, giro, anio_inicio, sigue_operando, id_rango_empleados)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [id_egresado, e.nombre, e.giro, e.anio_inicio, e.sigue_operando,
              e.id_rango_empleados],
          );
        }

        for (const p of trayectoria.proyectos_sociales) {
          await qr.query(
            `INSERT INTO egresado_proyectos_sociales
               (id_egresado, nombre, id_tipo_proyecto, anio, organizacion)
             VALUES (?, ?, ?, ?, ?)`,
            [id_egresado, p.nombre, p.id_tipo_proyecto, p.anio, p.organizacion],
          );
        }
      }

      await qr.commitTransaction();
    } catch (error: any) {
      if (qr.isTransactionActive) await qr.rollbackTransaction();

      const esDuplicado =
        error?.code === 'ER_DUP_ENTRY' ||
        error?.errno === 1062 ||
        error?.driverError?.code === 'ER_DUP_ENTRY';

      if (esDuplicado) {
        throw new ConflictException(
          'Ya tenemos registradas tus respuestas. Si necesitas corregir algún dato, comunícate con vinculación.',
        );
      }
      throw error;
    } finally {
      await qr.release();
    }

    // Las notificaciones van DESPUÉS del commit: usan otra conexión y
    // dependen de que el egresado ya exista. No contienen datos sensibles.

    if (dto.autorizaciones.contacto) {
      await this.notificacionesService.crear({
        tipo: 'contacto',
        titulo: 'Egresado autorizó contacto',
        descripcion: `${dto.nombre_completo} autorizó ser contactado para oportunidades laborales`,
        id_egresado,
      });
    }

    if (dto.autorizaciones.eventos) {
      await this.notificacionesService.crear({
        tipo: 'eventos',
        titulo: 'Egresado autorizó participación en eventos',
        descripcion: `${dto.nombre_completo} autorizó ser contactado para participar en actividades académicas y eventos institucionales`,
        id_egresado,
      });
    }

    return { id_egresado, mensaje: 'Etapa 1 guardada correctamente.' };
  }

  // ETAPA 2
  async completarEtapa2(
    id_egresado: number,
    dto: CreateEgresadoEtapa2Dto,
  ): Promise<{ mensaje: string }> {

    const existe = await this.egresadosRepo.findOne({ where: { id_egresado } });
    if (!existe) {
      throw new NotFoundException(`No se encontró el egresado con id ${id_egresado}.`);
    }

    const coincidencia_laboral_id = await this.resolveId(
      'coincidencia_laboral', 'id_coincidencia', 'nivel', dto.coincidencia_laboral,
    );

    await this.dataSource.query(
      `UPDATE egresados
     SET numero_control          = ?,
         linkedin                = ?,
         coincidencia_laboral_id = ?,
         registro_completo       = 1
   WHERE id_egresado = ?`,
      [
        dto.numero_control,
        dto.linkedin?.trim() || null,
        coincidencia_laboral_id,
        id_egresado,
      ],
    );

    if (dto.certificaciones && dto.certificaciones.trim() !== '') {
      await this.dataSource.query(
        `INSERT INTO certificaciones (id_egresado, nombre_certificacion) VALUES (?, ?)`,
        [id_egresado, dto.certificaciones.trim()],
      );
    }

    for (const hab of dto.habilidades) {
      const rows = await this.dataSource.query(
        `SELECT id_habilidad FROM habilidades WHERE habilidad = ? LIMIT 1`, [hab],
      );
      if (rows.length) {
        await this.dataSource.query(
          `INSERT INTO egresado_habilidades (id_egresado, id_habilidad) VALUES (?, ?)`,
          [id_egresado, rows[0].id_habilidad],
        );
      }
    }

    if (dto.habilidad_otro && dto.habilidad_otro.trim() !== '') {
      await this.dataSource.query(
        `INSERT INTO habilidades_otro (id_egresado, descripcion) VALUES (?, ?)`,
        [id_egresado, dto.habilidad_otro.trim()],
      );
    }

    for (const col of dto.colaboraciones) {
      const rows = await this.dataSource.query(
        `SELECT id_colaboracion FROM colaboraciones WHERE descripcion = ? LIMIT 1`, [col],
      );
      if (rows.length) {
        await this.dataSource.query(
          `INSERT INTO egresado_colaboraciones (id_egresado, id_colaboracion) VALUES (?, ?)`,
          [id_egresado, rows[0].id_colaboracion],
        );
      }
    }

    if (dto.colaboracion_otro && dto.colaboracion_otro.trim() !== '') {
      await this.dataSource.query(
        `INSERT INTO colaboracion_otro (id_egresado, descripcion) VALUES (?, ?)`,
        [id_egresado, dto.colaboracion_otro.trim()],
      );
    }

    // Notificación destacada
    const egresadoRow = await this.dataSource.query(
      `SELECT e.nombre_completo, c.nombre_carrera, e.anio_egreso,
            e.ciudad_trabajo, e.ciudad_residencia,
            a.autorizo_contacto, a.autorizo_eventos
     FROM egresados e
     LEFT JOIN carreras       c ON e.carrera_id  = c.id_carrera
     LEFT JOIN autorizaciones a ON e.id_egresado = a.id_egresado
     WHERE e.id_egresado = ?`,
      [id_egresado],
    );

    if (egresadoRow.length > 0) {
      const eg = egresadoRow[0];
      await this.generarNotificacionDestacada(
        id_egresado,
        eg.nombre_completo,
        eg.nombre_carrera,
        eg.anio_egreso,
        eg.ciudad_trabajo || '',
        eg.ciudad_residencia,
        !!eg.autorizo_contacto,
        !!eg.autorizo_eventos,
      );
    }

    return { mensaje: 'Etapa 2 completada. Registro finalizado.' };
  }

  // BUSCAR POR CORREO
  async buscarPorCorreo(
    correoRaw: string,
  ): Promise<{ id_egresado: number; registro_completo: boolean } | null> {
    const correo = (correoRaw || '').trim().toLowerCase();
    const rows = await this.dataSource.query(
      `SELECT id_egresado, registro_completo FROM egresados WHERE correo = ? LIMIT 1`,
      [correo],
    );
    return rows.length
      ? { id_egresado: rows[0].id_egresado, registro_completo: !!rows[0].registro_completo }
      : null;
  }


  // FIND ALL
  async findAll(): Promise<Egresado[]> {
    return this.egresadosRepo.find();
  }

  async findAllConDetalles(): Promise<any[]> {
    return this.dataSource.query(`
    SELECT
      e.id_egresado, e.nombre_completo, e.correo, e.telefono,
      e.ciudad_residencia, e.anio_egreso, e.empresa, e.ciudad_trabajo,
      e.fecha_registro, e.numero_control, e.linkedin, e.puesto_trabajo,
      e.estatus_titulacion, e.satisfaccion_formacion, e.foto_url,
      e.revisado, e.fecha_revision, e.revisado_por,
      g.genero, c.nombre_carrera,
      ni.nivel     AS nivel_ingles,
      ae.rango     AS antiguedad_empleo,
      cl.nivel     AS coincidencia_laboral,
      sl.situacion AS situacion_laboral,
      cv.respuesta AS certificacion_vigente,
      aut.autorizo_estadisticas,
      aut.autorizo_contacto,
      aut.autorizo_eventos
    FROM egresados e
    LEFT JOIN generos                  g   ON e.genero_id                  = g.id_genero
    LEFT JOIN carreras                 c   ON e.carrera_id                 = c.id_carrera
    LEFT JOIN niveles_ingles           ni  ON e.nivel_ingles_id            = ni.id_nivel
    LEFT JOIN antiguedad_empleo        ae  ON e.antiguedad_empleo_id       = ae.id_antiguedad
    LEFT JOIN coincidencia_laboral     cl  ON e.coincidencia_laboral_id    = cl.id_coincidencia
    LEFT JOIN situacion_laboral        sl  ON e.situacion_laboral_id       = sl.id_situacion
    LEFT JOIN certificaciones_vigentes cv  ON e.certificacion_vigente_id   = cv.id_certificacion_vigente
    LEFT JOIN autorizaciones           aut ON e.id_egresado                = aut.id_egresado
    ORDER BY e.id_egresado DESC
  `);
  }

  // REMOVE
  async remove(id: number): Promise<{ mensaje: string }> {
    const existe = await this.egresadosRepo.findOne({ where: { id_egresado: id } });
    if (!existe) {
      throw new NotFoundException(`No se encontró el egresado con id ${id}.`);
    }

    await this.borrarEgresadoCompleto(id);

    if (existe.foto_url) {
      try {
        await unlink(join(process.cwd(), existe.foto_url));
      } catch {
        // Archivo ya no existe en disco — no es error crítico
      }
    }

    return { mensaje: 'Egresado eliminado correctamente.' };
  }


  // GET PERFIL
  async getPerfil(id: number): Promise<any> {
    const rows = await this.dataSource.query(`
    SELECT
      e.id_egresado, e.nombre_completo, e.correo, e.telefono,
            e.ciudad_residencia, e.pais_nacimiento,
      e.anio_ingreso, e.periodo_ingreso, e.anio_egreso,
      e.empresa, e.ciudad_trabajo,
      e.fecha_registro, e.numero_control, e.linkedin, e.puesto_trabajo,
      e.estatus_titulacion, e.satisfaccion_formacion, e.foto_url,
      e.facebook, e.instagram,
      e.medio_primer_empleo_otro,
      e.primer_empleo_empresa, e.primer_empleo_puesto,
      g.genero, c.nombre_carrera,
      ni.nivel        AS nivel_ingles,
      ae.rango        AS antiguedad_empleo,
      cl.nivel        AS coincidencia_laboral,
      sl.situacion    AS situacion_laboral,
      cv.respuesta    AS certificacion_vigente,
      tpe.rango       AS tiempo_primer_empleo,
      mpe.medio       AS medio_primer_empleo,
      aut.autorizo_estadisticas,
      aut.autorizo_contacto,
      aut.autorizo_eventos
    FROM egresados e
    LEFT JOIN generos                  g   ON e.genero_id                = g.id_genero
    LEFT JOIN carreras                 c   ON e.carrera_id               = c.id_carrera
    LEFT JOIN niveles_ingles           ni  ON e.nivel_ingles_id          = ni.id_nivel
    LEFT JOIN antiguedad_empleo        ae  ON e.antiguedad_empleo_id     = ae.id_antiguedad
    LEFT JOIN coincidencia_laboral     cl  ON e.coincidencia_laboral_id  = cl.id_coincidencia
    LEFT JOIN situacion_laboral        sl  ON e.situacion_laboral_id     = sl.id_situacion
    LEFT JOIN certificaciones_vigentes cv  ON e.certificacion_vigente_id = cv.id_certificacion_vigente
    LEFT JOIN tiempo_primer_empleo     tpe ON e.tiempo_primer_empleo_id  = tpe.id_tiempo
    LEFT JOIN medio_primer_empleo      mpe ON e.medio_primer_empleo_id   = mpe.id_medio
    LEFT JOIN autorizaciones           aut ON e.id_egresado              = aut.id_egresado
    WHERE e.id_egresado = ?
  `, [id]);

    if (!rows.length) throw new NotFoundException(`Egresado ${id} no encontrado.`);
    const egresado = rows[0];

    // Si eligió "Otra", mostramos el texto libre en lugar de la etiqueta del catálogo
    const medioFinal =
      egresado.medio_primer_empleo === 'Otra' && egresado.medio_primer_empleo_otro
        ? `Otra: ${egresado.medio_primer_empleo_otro}`
        : egresado.medio_primer_empleo;

    const certificaciones = await this.dataSource.query(
      `SELECT nombre_certificacion FROM certificaciones WHERE id_egresado = ?`, [id],
    );
    const habilidades = await this.dataSource.query(`
    SELECT h.habilidad FROM egresado_habilidades eh
    JOIN habilidades h ON eh.id_habilidad = h.id_habilidad
    WHERE eh.id_egresado = ?
  `, [id]);
    const habilidadesOtro = await this.dataSource.query(
      `SELECT descripcion FROM habilidades_otro WHERE id_egresado = ?`, [id],
    );
    const colaboraciones = await this.dataSource.query(`
    SELECT c.descripcion FROM egresado_colaboraciones ec
    JOIN colaboraciones c ON ec.id_colaboracion = c.id_colaboracion
    WHERE ec.id_egresado = ?
  `, [id]);
    const colaboracionesOtro = await this.dataSource.query(
      `SELECT descripcion FROM colaboracion_otro WHERE id_egresado = ?`, [id],
    );

    // Trayectoria profesional: descripciones legibles, no ids
    const estudios = await this.dataSource.query(`
    SELECT ne.descripcion AS nivel, es.nombre_programa, es.institucion,
           ee.descripcion AS estado, es.anio
    FROM egresado_estudios es
    JOIN niveles_estudio ne ON es.id_nivel_estudio  = ne.id_nivel_estudio
    JOIN estados_estudio ee ON es.id_estado_estudio = ee.id_estado_estudio
    WHERE es.id_egresado = ?
    ORDER BY es.id_estudio
  `, [id]);
    const emprendimientos = await this.dataSource.query(`
    SELECT em.nombre, em.giro, em.anio_inicio, em.sigue_operando,
           re.descripcion AS rango_empleados
    FROM egresado_emprendimientos em
    LEFT JOIN rangos_empleados re ON em.id_rango_empleados = re.id_rango_empleados
    WHERE em.id_egresado = ?
    ORDER BY em.id_emprendimiento
  `, [id]);
    const proyectosSociales = await this.dataSource.query(`
    SELECT ps.nombre, tp.descripcion AS tipo, ps.anio, ps.organizacion
    FROM egresado_proyectos_sociales ps
    JOIN tipos_proyecto_social tp ON ps.id_tipo_proyecto = tp.id_tipo_proyecto
    WHERE ps.id_egresado = ?
    ORDER BY ps.id_proyecto
  `, [id]);

    return {
      ...egresado,
      medio_primer_empleo: medioFinal,
      certificaciones: certificaciones.map((r: any) => r.nombre_certificacion),
      habilidades: habilidades.map((r: any) => r.habilidad),
      habilidades_otro: habilidadesOtro.map((r: any) => r.descripcion),
      colaboraciones: colaboraciones.map((r: any) => r.descripcion),
      colaboraciones_otro: colaboracionesOtro.map((r: any) => r.descripcion),
      estudios,
      emprendimientos: emprendimientos.map((r: any) => ({
        ...r,
        sigue_operando: !!r.sigue_operando,
      })),
      proyectos_sociales: proyectosSociales,
    };
  }

  // ESTADÍSTICAS
  async getEstadisticas(
    carrera?: string,
    anio?: number,
    tiempo?: string,
    medio?: string,
  ): Promise<any> {

    const params: any[] = [];
    const conditions: string[] = ['1=1'];

    if (carrera) {
      conditions.push(`c.nombre_carrera = ?`);
      params.push(carrera);
    }
    if (anio) {
      conditions.push(`e.anio_egreso = ?`);
      params.push(anio);
    }
    if (tiempo) {
      conditions.push(
        `e.tiempo_primer_empleo_id = (SELECT id_tiempo FROM tiempo_primer_empleo WHERE rango = ?)`,
      );
      params.push(tiempo);
    }
    if (medio) {
      conditions.push(
        `e.medio_primer_empleo_id = (SELECT id_medio FROM medio_primer_empleo WHERE medio = ?)`,
      );
      params.push(medio);
    }

    const where = `WHERE ${conditions.join(' AND ')}`;

    // 1. KPIs
    const [kpis] = await this.dataSource.query(`
      SELECT
        COUNT(*)                                              AS total_egresados,
        SUM(aut.autorizo_contacto)                            AS autorizo_contacto,
        SUM(aut.autorizo_eventos)                             AS autorizo_eventos,
        ROUND(AVG(e.satisfaccion_formacion), 2)               AS satisfaccion_promedio,
        SUM(e.estatus_titulacion = 'Titulado')                AS titulados,
        SUM(e.estatus_titulacion = 'En trámite')              AS en_tramite,
        SUM(e.estatus_titulacion = 'No titulado')             AS no_titulados,
        SUM(sl.situacion != 'Desempleado')                    AS empleados,
        SUM(sl.situacion  = 'Desempleado')                    AS desempleados
      FROM egresados e
      LEFT JOIN autorizaciones    aut ON e.id_egresado           = aut.id_egresado
      LEFT JOIN situacion_laboral sl  ON e.situacion_laboral_id  = sl.id_situacion
      LEFT JOIN carreras          c   ON e.carrera_id            = c.id_carrera
      ${where}
    `, params);

    // 2. Situación laboral
    const situacionLaboral = await this.dataSource.query(`
      SELECT sl.situacion, COUNT(*) AS total
      FROM egresados e
      LEFT JOIN situacion_laboral sl ON e.situacion_laboral_id = sl.id_situacion
      LEFT JOIN carreras c ON e.carrera_id = c.id_carrera
      ${where}
      GROUP BY sl.situacion ORDER BY total DESC
    `, params);

    // 3. Empleabilidad por carrera
    const empleabilidadCarrera = await this.dataSource.query(`
      SELECT c.nombre_carrera, COUNT(*) AS total,
             SUM(sl.situacion != 'Desempleado') AS empleados
      FROM egresados e
      LEFT JOIN carreras          c  ON e.carrera_id           = c.id_carrera
      LEFT JOIN situacion_laboral sl ON e.situacion_laboral_id = sl.id_situacion
      ${where}
      GROUP BY c.nombre_carrera ORDER BY empleados DESC
    `, params);

    // 4. Titulación por año
    const titulacionAnio = await this.dataSource.query(`
      SELECT e.anio_egreso, COUNT(*) AS total,
             SUM(e.estatus_titulacion = 'Titulado')   AS titulados,
             SUM(e.estatus_titulacion = 'En trámite') AS en_tramite,
             ROUND(SUM(e.estatus_titulacion = 'Titulado') * 100.0 / COUNT(*), 1) AS pct_titulados
      FROM egresados e
      LEFT JOIN carreras c ON e.carrera_id = c.id_carrera
      ${where}
      GROUP BY e.anio_egreso ORDER BY e.anio_egreso ASC
    `, params);

    // 4b. Titulación por cohorte de ingreso
    const titulacionCohorte = await this.dataSource.query(`
      SELECT e.anio_ingreso, COUNT(*) AS total,
             SUM(e.estatus_titulacion = 'Titulado')   AS titulados,
             SUM(e.estatus_titulacion = 'En trámite') AS en_tramite,
             SUM(e.estatus_titulacion = 'No titulado') AS no_titulados,
             ROUND(SUM(e.estatus_titulacion = 'Titulado') * 100.0 / COUNT(*), 1) AS pct_titulados
      FROM egresados e
      LEFT JOIN carreras c ON e.carrera_id = c.id_carrera
      ${where} AND e.anio_ingreso IS NOT NULL
      GROUP BY e.anio_ingreso ORDER BY e.anio_ingreso ASC
    `, params);

    // 4c. Cobertura del dato de cohorte
    const coberturaCohorte = await this.dataSource.query(`
      SELECT COUNT(*) AS total,
             SUM(e.anio_ingreso IS NOT NULL) AS con_cohorte
      FROM egresados e
      LEFT JOIN carreras c ON e.carrera_id = c.id_carrera
      ${where}
    `, params);

    // 5. Niveles de inglés
    const nivelesIngles = await this.dataSource.query(`
      SELECT ni.nivel, COUNT(*) AS total
      FROM egresados e
      LEFT JOIN niveles_ingles ni ON e.nivel_ingles_id = ni.id_nivel
      LEFT JOIN carreras c ON e.carrera_id = c.id_carrera
      ${where}
      GROUP BY ni.nivel ORDER BY total DESC
    `, params);

    // 6. Inglés por carrera
    const inglesCarrera = await this.dataSource.query(`
      SELECT c.nombre_carrera, ni.nivel, COUNT(*) AS total
      FROM egresados e
      LEFT JOIN niveles_ingles ni ON e.nivel_ingles_id = ni.id_nivel
      LEFT JOIN carreras c ON e.carrera_id = c.id_carrera
      ${where}
      GROUP BY c.nombre_carrera, ni.nivel ORDER BY c.nombre_carrera, total DESC
    `, params);

    // 7. Satisfacción por carrera
    const satisfaccionCarrera = await this.dataSource.query(`
      SELECT c.nombre_carrera, ROUND(AVG(e.satisfaccion_formacion), 2) AS promedio
      FROM egresados e
      LEFT JOIN carreras c ON e.carrera_id = c.id_carrera
      ${where}
      GROUP BY c.nombre_carrera ORDER BY promedio DESC
    `, params);

    // 8. Top empresas
    const topEmpresas = await this.dataSource.query(`
      SELECT e.empresa, COUNT(*) AS total
      FROM egresados e
      LEFT JOIN carreras c ON e.carrera_id = c.id_carrera
      ${where}
      AND e.empresa IS NOT NULL AND e.empresa != ''
      GROUP BY e.empresa ORDER BY total DESC LIMIT 10
    `, params);

    // 9. Evolución por generación
    const evolucionGeneracion = await this.dataSource.query(`
      SELECT e.anio_egreso, COUNT(*) AS total,
             ROUND(SUM(sl.situacion != 'Desempleado') * 100.0 / COUNT(*), 1) AS pct_empleados,
             ROUND(SUM(e.estatus_titulacion = 'Titulado') * 100.0 / COUNT(*), 1) AS pct_titulados,
             ROUND(AVG(e.satisfaccion_formacion) * 20, 1) AS satisfaccion_pct
      FROM egresados e
      LEFT JOIN situacion_laboral sl ON e.situacion_laboral_id = sl.id_situacion
      LEFT JOIN carreras c ON e.carrera_id = c.id_carrera
      ${where}
      GROUP BY e.anio_egreso ORDER BY e.anio_egreso ASC
    `, params);

    // 10. Sector laboral
    const sectorLaboral = await this.dataSource.query(`
      SELECT sl.situacion AS sector, COUNT(*) AS total
      FROM egresados e
      LEFT JOIN situacion_laboral sl ON e.situacion_laboral_id = sl.id_situacion
      LEFT JOIN carreras c ON e.carrera_id = c.id_carrera
      ${where}
      GROUP BY sl.situacion ORDER BY total DESC
    `, params);

    // 11. Participación por carrera
    const participacionCarrera = await this.dataSource.query(`
      SELECT c.nombre_carrera,
             SUM(aut.autorizo_contacto) AS autorizo_contacto,
             SUM(aut.autorizo_eventos)  AS autorizo_eventos,
             COUNT(*) AS total
      FROM egresados e
      LEFT JOIN autorizaciones aut ON e.id_egresado = aut.id_egresado
      LEFT JOIN carreras c         ON e.carrera_id  = c.id_carrera
      ${where}
      GROUP BY c.nombre_carrera ORDER BY total DESC
    `, params);

    // 12. Fuera de México
    const fueraMexico = await this.dataSource.query(`
      SELECT e.ciudad_trabajo, c.nombre_carrera, COUNT(*) AS total
      FROM egresados e
      LEFT JOIN carreras c ON e.carrera_id = c.id_carrera
      ${where}
      AND e.ciudad_trabajo IS NOT NULL
      AND e.ciudad_trabajo != ''
      AND e.ciudad_trabajo NOT LIKE '%México%'
      AND e.ciudad_trabajo NOT LIKE '%Mexico%'
      GROUP BY e.ciudad_trabajo, c.nombre_carrera
      ORDER BY total DESC
    `, params);

    // 13. Fuera de Durango (en México, sin Durango)
    const fueraDurango = await this.dataSource.query(`
      SELECT e.ciudad_trabajo, c.nombre_carrera, COUNT(*) AS total
      FROM egresados e
      LEFT JOIN carreras c ON e.carrera_id = c.id_carrera
      ${where}
      AND e.ciudad_trabajo IS NOT NULL
      AND e.ciudad_trabajo != ''
      AND (e.ciudad_trabajo LIKE '%México%' OR e.ciudad_trabajo LIKE '%Mexico%')
      AND e.ciudad_trabajo NOT LIKE 'Durango%'
      GROUP BY e.ciudad_trabajo, c.nombre_carrera
      ORDER BY total DESC
    `, params);

    // 14. Coincidencia laboral por carrera
    const coincidenciaCarrera = await this.dataSource.query(`
      SELECT
        c.nombre_carrera,
        cl.nivel AS coincidencia,
        COUNT(*) AS total,
        ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (PARTITION BY c.nombre_carrera), 1) AS porcentaje
      FROM egresados e
      LEFT JOIN carreras             c  ON e.carrera_id             = c.id_carrera
      LEFT JOIN coincidencia_laboral cl ON e.coincidencia_laboral_id = cl.id_coincidencia
      ${where}
      AND e.carrera_id NOT IN (15, 16)
      GROUP BY c.nombre_carrera, cl.nivel
      ORDER BY c.nombre_carrera, total DESC
    `, params);

    // 15. Tiempo REAL para conseguir el primer empleo, por carrera
    //     Lee el dato declarado por el egresado (catálogo tiempo_primer_empleo)
    //     en lugar de estimarlo con YEAR(NOW()). El INNER JOIN excluye a los
    //     egresados sin el dato (registros viejos = NULL). Se excluye además a
    //     quien nunca se empleó ('Aún no he conseguido empleo').
    const tiempoEmpleoCarrera = await this.dataSource.query(`
      SELECT
        c.nombre_carrera,
        COUNT(*) AS total_egresados,
        ROUND(AVG(
          CASE tpe.rango
            WHEN 'Menos de 3 meses'   THEN 0.125
            WHEN 'De 3 a 6 meses'     THEN 0.375
            WHEN 'De 6 meses a 1 año' THEN 0.75
            WHEN 'De 1 a 2 años'      THEN 1.5
            WHEN 'Más de 2 años'      THEN 2.5
          END
        ), 2) AS anios_promedio_para_emplearse
      FROM egresados e
      LEFT JOIN carreras c          ON e.carrera_id              = c.id_carrera
      JOIN tiempo_primer_empleo tpe ON e.tiempo_primer_empleo_id = tpe.id_tiempo
      ${where}
      AND tpe.rango <> 'Aún no he conseguido empleo'
      GROUP BY c.nombre_carrera
      ORDER BY anios_promedio_para_emplearse ASC
    `, params);

    // 15-b. Distribución REAL del tiempo al primer empleo, por carrera y rango
    const distribucionTiempoEmpleo = await this.dataSource.query(`
      SELECT
        c.nombre_carrera,
        tpe.id_tiempo,
        tpe.rango,
        COUNT(*) AS total
      FROM egresados e
      LEFT JOIN carreras c          ON e.carrera_id              = c.id_carrera
      JOIN tiempo_primer_empleo tpe ON e.tiempo_primer_empleo_id = tpe.id_tiempo
      ${where}
      GROUP BY c.nombre_carrera, tpe.id_tiempo, tpe.rango
      ORDER BY c.nombre_carrera ASC, tpe.id_tiempo ASC
    `, params);

    // 15-c. Medio por el que consiguieron el primer empleo
    const medioPrimerEmpleo = await this.dataSource.query(`
      SELECT
        mpe.id_medio,
        mpe.medio,
        mpe.orden,
        COUNT(*) AS total
      FROM egresados e
      LEFT JOIN carreras c         ON e.carrera_id             = c.id_carrera
      JOIN medio_primer_empleo mpe ON e.medio_primer_empleo_id = mpe.id_medio
      ${where}
      GROUP BY mpe.id_medio, mpe.medio, mpe.orden
      ORDER BY mpe.orden ASC
    `, params);

    // 16. Tiempo REAL promedio global para el primer empleo (KPI)
    const [tiempoEmpleoGeneral] = await this.dataSource.query(`
      SELECT
        ROUND(AVG(
          CASE tpe.rango
            WHEN 'Menos de 3 meses'   THEN 0.125
            WHEN 'De 3 a 6 meses'     THEN 0.375
            WHEN 'De 6 meses a 1 año' THEN 0.75
            WHEN 'De 1 a 2 años'      THEN 1.5
            WHEN 'Más de 2 años'      THEN 2.5
          END
        ), 2) AS anios_promedio_general
      FROM egresados e
      LEFT JOIN carreras c          ON e.carrera_id              = c.id_carrera
      JOIN tiempo_primer_empleo tpe ON e.tiempo_primer_empleo_id = tpe.id_tiempo
      ${where}
      AND tpe.rango <> 'Aún no he conseguido empleo'
    `, params);

    // TITULACIÓN

    // 17. Titulación por carrera
    const titulacionCarrera = await this.dataSource.query(`
      SELECT
        c.nombre_carrera,
        COUNT(*)                                                               AS total,
        SUM(e.estatus_titulacion = 'Titulado')                                AS titulados,
        SUM(e.estatus_titulacion = 'En trámite')                              AS en_tramite,
        SUM(e.estatus_titulacion = 'No titulado')                             AS no_titulados,
        ROUND(SUM(e.estatus_titulacion = 'Titulado')    * 100.0 / COUNT(*), 1) AS pct_titulados,
        ROUND(SUM(e.estatus_titulacion = 'En trámite')  * 100.0 / COUNT(*), 1) AS pct_en_tramite,
        ROUND(SUM(e.estatus_titulacion = 'No titulado') * 100.0 / COUNT(*), 1) AS pct_no_titulados
      FROM egresados e
      LEFT JOIN carreras c ON e.carrera_id = c.id_carrera
      ${where}
      AND e.carrera_id NOT IN (15, 16)
      GROUP BY c.nombre_carrera
      ORDER BY pct_titulados DESC
    `, params);

    // 18. Egresados con posgrado
    const posgradoParams: any[] = [];
    const posgradoConditions: string[] = ['e.carrera_id IN (15, 16)'];
    if (anio) {
      posgradoConditions.push(`e.anio_egreso = ?`);
      posgradoParams.push(anio);
    }
    const posgradoWhere = `WHERE ${posgradoConditions.join(' AND ')}`;

    const posgradoPorTipo = await this.dataSource.query(`
      SELECT
        c.nombre_carrera AS tipo_posgrado,
        COUNT(*)         AS total
      FROM egresados e
      LEFT JOIN carreras c ON e.carrera_id = c.id_carrera
      ${posgradoWhere}
      GROUP BY c.nombre_carrera
      ORDER BY total DESC
    `, posgradoParams);

    const [totalPosgrado] = await this.dataSource.query(`
      SELECT COUNT(*) AS total
      FROM egresados e
      ${posgradoWhere}
    `, posgradoParams);

    // 19. Titulación por carrera y año
    const titulacionCarreraAnio = await this.dataSource.query(`
      SELECT
        c.nombre_carrera,
        e.anio_egreso,
        COUNT(*)                                                               AS total,
        SUM(e.estatus_titulacion = 'Titulado')                                AS titulados,
        SUM(e.estatus_titulacion = 'En trámite')                              AS en_tramite,
        SUM(e.estatus_titulacion = 'No titulado')                             AS no_titulados,
        ROUND(SUM(e.estatus_titulacion = 'Titulado') * 100.0 / COUNT(*), 1)   AS pct_titulados
      FROM egresados e
      LEFT JOIN carreras c ON e.carrera_id = c.id_carrera
      ${where}
      AND e.carrera_id NOT IN (15, 16)
      GROUP BY c.nombre_carrera, e.anio_egreso
      ORDER BY c.nombre_carrera ASC, e.anio_egreso ASC
    `, params);

    return {
      kpis,
      situacionLaboral,
      empleabilidadCarrera,
      titulacionAnio,
      titulacionCohorte,
      coberturaCohorte: coberturaCohorte[0],
      nivelesIngles,
      inglesCarrera,
      satisfaccionCarrera,
      topEmpresas,
      evolucionGeneracion,
      sectorLaboral,
      participacionCarrera,
      fueraMexico,
      fueraDurango,
      coincidenciaCarrera,
      tiempoEmpleoCarrera,
      tiempoEmpleoGeneral,
      distribucionTiempoEmpleo,
      medioPrimerEmpleo,
      titulacionCarrera,
      posgradoPorTipo,
      totalPosgrado,
      titulacionCarreraAnio,
    };
  }

  // DISTRIBUCIÓN GEOGRÁFICA
  async getDistribucionGeografica(carrera?: string, anio?: number): Promise<any> {

    const params: any[] = [];
    const conditions: string[] = ['1=1'];

    if (carrera) {
      conditions.push(`c.nombre_carrera = ?`);
      params.push(carrera);
    }
    if (anio) {
      conditions.push(`e.anio_egreso = ?`);
      params.push(anio);
    }

    const where = `WHERE ${conditions.join(' AND ')}`;

    // 1. KPIs geográficos
    const [kpisGeo] = await this.dataSource.query(`
      SELECT
        COUNT(*)                                                              AS total_mapeados,
        SUM(
          e.ciudad_trabajo IS NOT NULL
          AND e.ciudad_trabajo != ''
        )                                                                     AS con_ciudad_trabajo,
        SUM(
          e.ciudad_trabajo IS NOT NULL
          AND e.ciudad_trabajo != ''
          AND TRIM(SUBSTRING_INDEX(e.ciudad_trabajo, ',', -1)) != 'México'
        )                                                                     AS en_extranjero,
        COUNT(DISTINCT
          CASE
            WHEN e.ciudad_trabajo IS NOT NULL
              AND e.ciudad_trabajo != ''
              AND TRIM(SUBSTRING_INDEX(e.ciudad_trabajo, ',', -1)) != 'México'
            THEN TRIM(SUBSTRING_INDEX(e.ciudad_trabajo, ',', -1))
          END
        )                                                                     AS paises_distintos,
        COUNT(DISTINCT
          CASE
            WHEN e.ciudad_trabajo IS NOT NULL AND e.ciudad_trabajo != ''
            THEN e.ciudad_trabajo
          END
        )                                                                     AS ciudades_trabajo_distintas
      FROM egresados e
      LEFT JOIN carreras c ON e.carrera_id = c.id_carrera
      ${where}
    `, params);

    // 2. Top ciudades de trabajo (todas, incluyendo Durango)
    const topCiudadesTrabajo = await this.dataSource.query(`
      SELECT
        e.ciudad_trabajo,
        COUNT(*) AS total
      FROM egresados e
      LEFT JOIN carreras c ON e.carrera_id = c.id_carrera
      ${where}
      AND e.ciudad_trabajo IS NOT NULL
      AND e.ciudad_trabajo != ''
      GROUP BY e.ciudad_trabajo
      ORDER BY total DESC
      LIMIT 10
    `, params);

    // 3. Egresados en el extranjero agrupados por país
    const extranjerosPorPais = await this.dataSource.query(`
      SELECT
        TRIM(SUBSTRING_INDEX(e.ciudad_trabajo, ',', -1)) AS pais,
        COUNT(*) AS total
      FROM egresados e
      LEFT JOIN carreras c ON e.carrera_id = c.id_carrera
      ${where}
      AND e.ciudad_trabajo IS NOT NULL
      AND e.ciudad_trabajo != ''
      AND TRIM(SUBSTRING_INDEX(e.ciudad_trabajo, ',', -1)) != 'México'
      GROUP BY pais
      ORDER BY total DESC
    `, params);

    // 4. Egresados en el extranjero con ciudad detallada
    const extranjerosDetalle = await this.dataSource.query(`
      SELECT
        e.ciudad_trabajo,
        TRIM(SUBSTRING_INDEX(e.ciudad_trabajo, ',', -1))  AS pais,
        COUNT(*) AS total
      FROM egresados e
      LEFT JOIN carreras c ON e.carrera_id = c.id_carrera
      ${where}
      AND e.ciudad_trabajo IS NOT NULL
      AND e.ciudad_trabajo != ''
      AND TRIM(SUBSTRING_INDEX(e.ciudad_trabajo, ',', -1)) != 'México'
      GROUP BY e.ciudad_trabajo
      ORDER BY total DESC
    `, params);

    // 5. Movilidad por año de egreso
    const movilidadPorAnio = await this.dataSource.query(`
      SELECT
        e.anio_egreso,
        COUNT(*)                                                AS total,
        SUM(
          e.ciudad_trabajo IS NOT NULL
          AND e.ciudad_trabajo != ''
          AND e.ciudad_trabajo NOT LIKE 'Durango%'
        )                                                       AS fuera_durango,
        SUM(
          e.ciudad_trabajo IS NOT NULL
          AND e.ciudad_trabajo != ''
          AND TRIM(SUBSTRING_INDEX(e.ciudad_trabajo, ',', -1)) != 'México'
        )                                                       AS en_extranjero,
        ROUND(
          SUM(
            e.ciudad_trabajo IS NOT NULL
            AND e.ciudad_trabajo != ''
            AND e.ciudad_trabajo NOT LIKE 'Durango%'
          ) * 100.0 / COUNT(*), 1
        )                                                       AS pct_fuera_durango,
        ROUND(
          SUM(
            e.ciudad_trabajo IS NOT NULL
            AND e.ciudad_trabajo != ''
            AND TRIM(SUBSTRING_INDEX(e.ciudad_trabajo, ',', -1)) != 'México'
          ) * 100.0 / COUNT(*), 1
        )                                                       AS pct_extranjero
      FROM egresados e
      LEFT JOIN carreras c ON e.carrera_id = c.id_carrera
      ${where}
      GROUP BY e.anio_egreso
      ORDER BY e.anio_egreso ASC
    `, params);

    // 6. Movilidad por carrera
    const movilidadPorCarrera = await this.dataSource.query(`
      SELECT
        c.nombre_carrera,
        COUNT(*)                                                AS total,
        SUM(
          e.ciudad_trabajo IS NOT NULL
          AND e.ciudad_trabajo != ''
          AND e.ciudad_trabajo NOT LIKE 'Durango%'
        )                                                       AS fuera_durango,
        ROUND(
          SUM(
            e.ciudad_trabajo IS NOT NULL
            AND e.ciudad_trabajo != ''
            AND e.ciudad_trabajo NOT LIKE 'Durango%'
          ) * 100.0 / COUNT(*), 1
        )                                                       AS pct_fuera_durango
      FROM egresados e
      LEFT JOIN carreras c ON e.carrera_id = c.id_carrera
      ${where}
      AND e.carrera_id NOT IN (15, 16)
      GROUP BY c.nombre_carrera
      ORDER BY pct_fuera_durango DESC
    `, params);

    return {
      kpisGeo,
      topCiudadesTrabajo,
      extranjerosPorPais,
      extranjerosDetalle,
      movilidadPorAnio,
      movilidadPorCarrera,
    };
  }

  // VINCULACIÓN: egresados por colaboración
  async getEgresadosPorColaboracion(colaboracion: string, carrera?: string, anio?: number): Promise<any[]> {
    const params: any[] = [colaboracion];
    const conditions: string[] = [`col.descripcion = ?`];

    if (carrera) { conditions.push(`c.nombre_carrera = ?`); params.push(carrera); }
    if (anio) { conditions.push(`e.anio_egreso = ?`); params.push(anio); }

    return this.dataSource.query(`
    SELECT e.id_egresado, e.nombre_completo, e.correo, e.telefono,
       c.nombre_carrera, g.genero, e.foto_url
    FROM egresado_colaboraciones ec
    JOIN colaboraciones col ON ec.id_colaboracion = col.id_colaboracion
    JOIN egresados e        ON ec.id_egresado     = e.id_egresado
    LEFT JOIN carreras c    ON e.carrera_id        = c.id_carrera
    LEFT JOIN generos g     ON e.genero_id         = g.id_genero
    WHERE ${conditions.join(' AND ')}
    ORDER BY e.nombre_completo ASC
  `, params);
  }

  // VINCULACIÓN: egresados por habilidad a reforzar
  async getEgresadosPorHabilidad(habilidad: string, carrera?: string, anio?: number): Promise<any[]> {
    const params: any[] = [habilidad];
    const conditions: string[] = [`h.habilidad = ?`];

    if (carrera) { conditions.push(`c.nombre_carrera = ?`); params.push(carrera); }
    if (anio) { conditions.push(`e.anio_egreso = ?`); params.push(anio); }

    return this.dataSource.query(`
    SELECT e.id_egresado, e.nombre_completo, e.correo, e.telefono,
          c.nombre_carrera, g.genero, e.foto_url
    FROM egresado_habilidades eh
    JOIN habilidades h      ON eh.id_habilidad = h.id_habilidad
    JOIN egresados e        ON eh.id_egresado  = e.id_egresado
    LEFT JOIN carreras c    ON e.carrera_id    = c.id_carrera
    LEFT JOIN generos g     ON e.genero_id     = g.id_genero
    WHERE ${conditions.join(' AND ')}
    ORDER BY e.nombre_completo ASC
  `, params);
  }

  // VINCULACIÓN: egresados por tipo de autorización
  async getEgresadosPorAutorizacion(
    tipo: 'estadisticas' | 'contacto' | 'eventos',
    carrera?: string,
    anio?: number,
  ): Promise<any[]> {
    const columnasPorTipo = {
      estadisticas: 'aut.autorizo_estadisticas',
      contacto: 'aut.autorizo_contacto',
      eventos: 'aut.autorizo_eventos',
    };

    if (!Object.prototype.hasOwnProperty.call(columnasPorTipo, tipo)) {
      throw new BadRequestException(
        `El parámetro "tipo" debe ser uno de: estadisticas, contacto, eventos.`,
      );
    }

    const columna = columnasPorTipo[tipo];

    const params: any[] = [];
    const conditions: string[] = [`${columna} = 1`];

    if (carrera) { conditions.push(`c.nombre_carrera = ?`); params.push(carrera); }
    if (anio) { conditions.push(`e.anio_egreso = ?`); params.push(anio); }

    const where = `WHERE ${conditions.join(' AND ')}`;

    return this.dataSource.query(`
    SELECT e.id_egresado, e.nombre_completo, e.correo, e.telefono,
        c.nombre_carrera, g.genero, e.foto_url
    FROM autorizaciones aut
    JOIN egresados  e ON aut.id_egresado = e.id_egresado
    LEFT JOIN carreras c ON e.carrera_id  = c.id_carrera
    LEFT JOIN generos  g ON e.genero_id   = g.id_genero
    ${where}
    ORDER BY e.nombre_completo ASC
  `, params);
  }

  // VINCULACIÓN: totales por colaboración (incluye "Otro")
  async getTotalesColaboraciones(carrera?: string, anio?: number): Promise<any[]> {
    const params: any[] = [];
    const joins: string[] = [
      'LEFT JOIN egresados e        ON ec.id_egresado     = e.id_egresado',
      'LEFT JOIN carreras  c        ON e.carrera_id       = c.id_carrera',
    ];
    const conditions: string[] = [];

    if (carrera) { conditions.push(`c.nombre_carrera = ?`); params.push(carrera); }
    if (anio) { conditions.push(`e.anio_egreso = ?`); params.push(anio); }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const fijas = await this.dataSource.query(`
    SELECT
      col.descripcion,
      COUNT(ec.id_egresado) AS total
    FROM colaboraciones col
    LEFT JOIN egresado_colaboraciones ec ON col.id_colaboracion = ec.id_colaboracion
    ${joins.join('\n')}
    ${where}
    GROUP BY col.id_colaboracion, col.descripcion
    ORDER BY total DESC
  `, params);

    const otroParams: any[] = [];
    const otroJoins = [
      'LEFT JOIN egresados e ON co.id_egresado = e.id_egresado',
      'LEFT JOIN carreras  c ON e.carrera_id   = c.id_carrera',
    ];
    const otroConditions: string[] = [];
    if (carrera) { otroConditions.push(`c.nombre_carrera = ?`); otroParams.push(carrera); }
    if (anio) { otroConditions.push(`e.anio_egreso = ?`); otroParams.push(anio); }
    const otroWhere = otroConditions.length ? `WHERE ${otroConditions.join(' AND ')}` : '';

    const [otro] = await this.dataSource.query(`
    SELECT COUNT(*) AS total
    FROM colaboracion_otro co
    ${otroJoins.join('\n')}
    ${otroWhere}
  `, otroParams);

    return [
      ...fijas,
      { descripcion: 'Otro', total: +otro.total || 0 },
    ];
  }

  // VINCULACIÓN: totales por habilidad (incluye "Otro")
  async getTotalesHabilidades(carrera?: string, anio?: number): Promise<any[]> {
    const params: any[] = [];
    const joins: string[] = [
      'LEFT JOIN egresados e ON eh.id_egresado  = e.id_egresado',
      'LEFT JOIN carreras  c ON e.carrera_id    = c.id_carrera',
    ];
    const conditions: string[] = [];

    if (carrera) { conditions.push(`c.nombre_carrera = ?`); params.push(carrera); }
    if (anio) { conditions.push(`e.anio_egreso = ?`); params.push(anio); }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const fijas = await this.dataSource.query(`
    SELECT
      h.habilidad,
      COUNT(eh.id_egresado) AS total
    FROM habilidades h
    LEFT JOIN egresado_habilidades eh ON h.id_habilidad = eh.id_habilidad
    ${joins.join('\n')}
    ${where}
    GROUP BY h.id_habilidad, h.habilidad
    ORDER BY total DESC
  `, params);

    const otroParams: any[] = [];
    const otroJoins = [
      'LEFT JOIN egresados e ON ho.id_egresado = e.id_egresado',
      'LEFT JOIN carreras  c ON e.carrera_id   = c.id_carrera',
    ];
    const otroConditions: string[] = [];
    if (carrera) { otroConditions.push(`c.nombre_carrera = ?`); otroParams.push(carrera); }
    if (anio) { otroConditions.push(`e.anio_egreso = ?`); otroParams.push(anio); }
    const otroWhere = otroConditions.length ? `WHERE ${otroConditions.join(' AND ')}` : '';

    const [otro] = await this.dataSource.query(`
    SELECT COUNT(*) AS total
    FROM habilidades_otro ho
    ${otroJoins.join('\n')}
    ${otroWhere}
  `, otroParams);

    return [
      ...fijas,
      { habilidad: 'Otro', total: +otro.total || 0 },
    ];
  }

  // VINCULACIÓN: egresados con colaboración "Otro"
  async getEgresadosColaboracionOtro(carrera?: string, anio?: number): Promise<any[]> {
    const params: any[] = [];
    const conditions: string[] = [];

    if (carrera) { conditions.push(`c.nombre_carrera = ?`); params.push(carrera); }
    if (anio) { conditions.push(`e.anio_egreso = ?`); params.push(anio); }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    return this.dataSource.query(`
    SELECT e.id_egresado, e.nombre_completo, e.correo, e.telefono,
           c.nombre_carrera, g.genero, e.foto_url, co.descripcion AS descripcion_otro
    FROM colaboracion_otro co
    JOIN egresados e     ON co.id_egresado = e.id_egresado
    LEFT JOIN carreras c ON e.carrera_id   = c.id_carrera
    LEFT JOIN generos g  ON e.genero_id    = g.id_genero
    ${where}
    ORDER BY e.nombre_completo ASC
  `, params);
  }

  // VINCULACIÓN: egresados con habilidad "Otro"
  async getEgresadosHabilidadOtro(carrera?: string, anio?: number): Promise<any[]> {
    const params: any[] = [];
    const conditions: string[] = [];

    if (carrera) { conditions.push(`c.nombre_carrera = ?`); params.push(carrera); }
    if (anio) { conditions.push(`e.anio_egreso = ?`); params.push(anio); }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    return this.dataSource.query(`
    SELECT e.id_egresado, e.nombre_completo, e.correo, e.telefono,
           c.nombre_carrera, g.genero, e.foto_url, ho.descripcion AS descripcion_otro
    FROM habilidades_otro ho
    JOIN egresados e     ON ho.id_egresado = e.id_egresado
    LEFT JOIN carreras c ON e.carrera_id   = c.id_carrera
    LEFT JOIN generos g  ON e.genero_id    = g.id_genero
    ${where}
    ORDER BY e.nombre_completo ASC
  `, params);
  }

  // VINCULACIÓN: distribución real de satisfacción (conteo por nivel 1-5)
  async getDistribucionSatisfaccion(carrera?: string, anio?: number): Promise<any[]> {
    const params: any[] = [];
    const conditions: string[] = ['satisfaccion_formacion IS NOT NULL'];

    if (carrera) { conditions.push(`c.nombre_carrera = ?`); params.push(carrera); }
    if (anio) { conditions.push(`e.anio_egreso = ?`); params.push(anio); }

    const where = `WHERE ${conditions.join(' AND ')}`;
    const join = (carrera || anio)
      ? `LEFT JOIN carreras c ON e.carrera_id = c.id_carrera`
      : '';

    return this.dataSource.query(`
    SELECT
      e.satisfaccion_formacion AS nivel,
      COUNT(*)                 AS total
    FROM egresados e
    ${join}
    ${where}
    GROUP BY e.satisfaccion_formacion
    ORDER BY e.satisfaccion_formacion ASC
  `, params);
  }

  // ── NORMALIZACIÓN DE GÉNERO ───────────────────────────────────────────────
  // La BD guarda 'masculino' / 'femenino'. Este CASE los normaliza a
  // 'Hombre' / 'Mujer' en todas las queries para que el frontend
  // no necesite conocer los valores internos de la BD.
  private readonly generoCase = `
    CASE g.genero
      WHEN 'masculino'       THEN 'Hombre'
      WHEN 'femenino'        THEN 'Mujer'
      ELSE g.genero
    END
  `;

  // ── ESTADÍSTICAS DE GÉNERO ────────────────────────────────────────────────
  async getEstadisticasGenero(carrera?: string, anio?: number): Promise<any> {

    const params: any[] = [];
    const conditions: string[] = ['1=1'];

    if (carrera) { conditions.push(`c.nombre_carrera = ?`); params.push(carrera); }
    if (anio) { conditions.push(`e.anio_egreso = ?`); params.push(anio); }

    const where = `WHERE ${conditions.join(' AND ')}`;

    // ── 1. KPIs principales por género ────────────────────────────────────
    const kpisGenero = await this.dataSource.query(`
      SELECT
        ${this.generoCase}                                                    AS genero,
        COUNT(*)                                                              AS total,
        ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (), 1)                   AS porcentaje
      FROM egresados e
      LEFT JOIN generos g  ON e.genero_id  = g.id_genero
      LEFT JOIN carreras c ON e.carrera_id = c.id_carrera
      ${where}
      GROUP BY g.genero
      ORDER BY total DESC
    `, params);

    // ── 2. Proporción H/M por carrera (para KPIs de carrera más femenina/masculina) ──
    const proporcionCarreraGenero = await this.dataSource.query(`
      SELECT
        c.nombre_carrera,
        ${this.generoCase}                                                    AS genero,
        COUNT(*)                                                              AS total,
        ROUND(
          COUNT(*) * 100.0
          / SUM(COUNT(*)) OVER (PARTITION BY c.nombre_carrera), 1
        )                                                                     AS porcentaje
      FROM egresados e
      LEFT JOIN carreras c ON e.carrera_id = c.id_carrera
      LEFT JOIN generos  g ON e.genero_id  = g.id_genero
      ${where}
      AND e.carrera_id NOT IN (15, 16)
      GROUP BY c.nombre_carrera, g.genero
      ORDER BY c.nombre_carrera, g.genero
    `, params);

    // ── 3. Egreso por año × género ────────────────────────────────────────
    const egresoAnioGenero = await this.dataSource.query(`
      SELECT
        e.anio_egreso,
        ${this.generoCase}                                                    AS genero,
        COUNT(*)                                                              AS total,
        ROUND(
          COUNT(*) * 100.0
          / SUM(COUNT(*)) OVER (PARTITION BY e.anio_egreso), 1
        )                                                                     AS porcentaje_en_anio
      FROM egresados e
      LEFT JOIN generos  g ON e.genero_id  = g.id_genero
      LEFT JOIN carreras c ON e.carrera_id = c.id_carrera
      ${where}
      GROUP BY e.anio_egreso, g.genero
      ORDER BY e.anio_egreso ASC, g.genero
    `, params);

    // ── 4. Composición H/M por carrera (barras 100% apiladas) ────────────
    const composicionCarreraGenero = await this.dataSource.query(`
      SELECT
        c.nombre_carrera,
        ${this.generoCase}                                                    AS genero,
        COUNT(*)                                                              AS total,
        ROUND(
          COUNT(*) * 100.0
          / SUM(COUNT(*)) OVER (PARTITION BY c.nombre_carrera), 1
        )                                                                     AS porcentaje
      FROM egresados e
      LEFT JOIN carreras c ON e.carrera_id = c.id_carrera
      LEFT JOIN generos  g ON e.genero_id  = g.id_genero
      ${where}
      AND e.carrera_id NOT IN (15, 16)
      GROUP BY c.nombre_carrera, g.genero
      ORDER BY c.nombre_carrera, g.genero
    `, params);

    // ── 5. Tasa de empleo por género ──────────────────────────────────────
    const empleabilidadGenero = await this.dataSource.query(`
      SELECT
        ${this.generoCase}                                                    AS genero,
        COUNT(*)                                                              AS total,
        SUM(sl.situacion != 'Desempleado')                                    AS empleados,
        SUM(sl.situacion  = 'Desempleado')                                    AS desempleados,
        ROUND(
          SUM(sl.situacion != 'Desempleado') * 100.0 / COUNT(*), 1
        )                                                                     AS pct_empleados,
        ROUND(AVG(e.satisfaccion_formacion), 2)                               AS satisfaccion_promedio
      FROM egresados e
      LEFT JOIN generos          g  ON e.genero_id           = g.id_genero
      LEFT JOIN situacion_laboral sl ON e.situacion_laboral_id = sl.id_situacion
      LEFT JOIN carreras         c  ON e.carrera_id          = c.id_carrera
      ${where}
      GROUP BY g.genero
    `, params);

    // ── 6. Sector laboral por género ──────────────────────────────────────
    const sectorLaboralGenero = await this.dataSource.query(`
      SELECT
        ${this.generoCase}                                                    AS genero,
        sl.situacion                                                          AS sector,
        COUNT(*)                                                              AS total,
        ROUND(
          COUNT(*) * 100.0
          / SUM(COUNT(*)) OVER (PARTITION BY g.genero), 1
        )                                                                     AS porcentaje
      FROM egresados e
      LEFT JOIN generos          g  ON e.genero_id           = g.id_genero
      LEFT JOIN situacion_laboral sl ON e.situacion_laboral_id = sl.id_situacion
      LEFT JOIN carreras         c  ON e.carrera_id          = c.id_carrera
      ${where}
      GROUP BY g.genero, sl.situacion
      ORDER BY g.genero, total DESC
    `, params);

    // ── 7. Coincidencia laboral por género ────────────────────────────────
    const coincidenciaLaboralGenero = await this.dataSource.query(`
      SELECT
        ${this.generoCase}                                                    AS genero,
        cl.nivel                                                              AS coincidencia,
        COUNT(*)                                                              AS total,
        ROUND(
          COUNT(*) * 100.0
          / SUM(COUNT(*)) OVER (PARTITION BY g.genero), 1
        )                                                                     AS porcentaje
      FROM egresados e
      LEFT JOIN generos             g  ON e.genero_id             = g.id_genero
      LEFT JOIN coincidencia_laboral cl ON e.coincidencia_laboral_id = cl.id_coincidencia
      LEFT JOIN carreras            c  ON e.carrera_id            = c.id_carrera
      ${where}
      GROUP BY g.genero, cl.nivel
      ORDER BY g.genero, total DESC
    `, params);

    // ── 8. Tiempo promedio en conseguir el primer empleo por género (meses) ──
    //     Lee el dato declarado (catálogo tiempo_primer_empleo), no la antigüedad
    //     en el empleo actual. INNER JOIN excluye registros viejos (NULL) y se
    //     descarta a quien nunca se empleó ('Aún no he conseguido empleo').
    const tiempoEmpleoGenero = await this.dataSource.query(`
      SELECT
        ${this.generoCase}                                                    AS genero,
        ROUND(AVG(
          CASE tpe.rango
            WHEN 'Menos de 3 meses'   THEN 1.5
            WHEN 'De 3 a 6 meses'     THEN 4.5
            WHEN 'De 6 meses a 1 año' THEN 9
            WHEN 'De 1 a 2 años'      THEN 18
            WHEN 'Más de 2 años'      THEN 30
          END
        ), 1)                                                                 AS tiempo_promedio_meses
      FROM egresados e
      LEFT JOIN generos          g   ON e.genero_id              = g.id_genero
      JOIN tiempo_primer_empleo  tpe ON e.tiempo_primer_empleo_id = tpe.id_tiempo
      LEFT JOIN carreras         c   ON e.carrera_id             = c.id_carrera
      ${where}
      AND tpe.rango <> 'Aún no he conseguido empleo'
      GROUP BY g.genero
    `, params);

    // ── 9. Distribución geográfica por género ─────────────────────────────
    const geografiaGenero = await this.dataSource.query(`
      SELECT
        ${this.generoCase}                                                    AS genero,
        COUNT(*)                                                              AS total,
        SUM(
          e.ciudad_trabajo LIKE 'Durango%'
          OR e.ciudad_trabajo IS NULL
          OR e.ciudad_trabajo = ''
        )                                                                     AS en_durango,
        SUM(
          e.ciudad_trabajo IS NOT NULL
          AND e.ciudad_trabajo != ''
          AND e.ciudad_trabajo NOT LIKE 'Durango%'
          AND TRIM(SUBSTRING_INDEX(e.ciudad_trabajo, ',', -1)) = 'México'
        )                                                                     AS fuera_durango_mexico,
        SUM(
          e.ciudad_trabajo IS NOT NULL
          AND e.ciudad_trabajo != ''
          AND TRIM(SUBSTRING_INDEX(e.ciudad_trabajo, ',', -1)) != 'México'
        )                                                                     AS en_extranjero,
        ROUND(
          SUM(
            e.ciudad_trabajo IS NOT NULL
            AND e.ciudad_trabajo != ''
            AND e.ciudad_trabajo NOT LIKE 'Durango%'
          ) * 100.0 / COUNT(*), 1
        )                                                                     AS pct_fuera_durango
      FROM egresados e
      LEFT JOIN generos  g ON e.genero_id  = g.id_genero
      LEFT JOIN carreras c ON e.carrera_id = c.id_carrera
      ${where}
      GROUP BY g.genero
    `, params);

    // ── 10. Top ciudades de trabajo por género ────────────────────────────
    const topCiudadesGenero = await this.dataSource.query(`
      SELECT
        ${this.generoCase}                                                    AS genero,
        e.ciudad_trabajo,
        COUNT(*)                                                              AS total
      FROM egresados e
      LEFT JOIN generos  g ON e.genero_id  = g.id_genero
      LEFT JOIN carreras c ON e.carrera_id = c.id_carrera
      ${where}
      AND e.ciudad_trabajo IS NOT NULL
      AND e.ciudad_trabajo != ''
      GROUP BY g.genero, e.ciudad_trabajo
      ORDER BY g.genero, total DESC
    `, params);

    // ── 11. Titulación global por género ──────────────────────────────────
    const titulacionGenero = await this.dataSource.query(`
      SELECT
        ${this.generoCase}                                                    AS genero,
        COUNT(*)                                                              AS total,
        SUM(e.estatus_titulacion = 'Titulado')                                AS titulados,
        SUM(e.estatus_titulacion = 'En trámite')                              AS en_tramite,
        SUM(e.estatus_titulacion = 'No titulado')                             AS no_titulados,
        ROUND(SUM(e.estatus_titulacion = 'Titulado')   * 100.0 / COUNT(*), 1) AS pct_titulados,
        ROUND(SUM(e.estatus_titulacion = 'En trámite') * 100.0 / COUNT(*), 1) AS pct_en_tramite,
        ROUND(SUM(e.estatus_titulacion = 'No titulado')* 100.0 / COUNT(*), 1) AS pct_no_titulados
      FROM egresados e
      LEFT JOIN generos  g ON e.genero_id  = g.id_genero
      LEFT JOIN carreras c ON e.carrera_id = c.id_carrera
      ${where}
      AND e.carrera_id NOT IN (15, 16)
      GROUP BY g.genero
    `, params);

    // ── 12. Titulación por año × género ───────────────────────────────────
    const titulacionAnioGenero = await this.dataSource.query(`
      SELECT
        e.anio_egreso,
        ${this.generoCase}                                                    AS genero,
        COUNT(*)                                                              AS total,
        SUM(e.estatus_titulacion = 'Titulado')                                AS titulados,
        ROUND(
          SUM(e.estatus_titulacion = 'Titulado') * 100.0 / COUNT(*), 1
        )                                                                     AS pct_titulados
      FROM egresados e
      LEFT JOIN generos  g ON e.genero_id  = g.id_genero
      LEFT JOIN carreras c ON e.carrera_id = c.id_carrera
      ${where}
      AND e.carrera_id NOT IN (15, 16)
      GROUP BY e.anio_egreso, g.genero
      ORDER BY e.anio_egreso ASC, g.genero
    `, params);

    // ── 13. Posgrado por género ───────────────────────────────────────────
    // No aplica filtro de carrera porque el posgrado IS carrera_id IN (15,16)
    const posgradoParams: any[] = [];
    const posgradoConditions: string[] = ['e.carrera_id IN (15, 16)'];
    if (anio) { posgradoConditions.push(`e.anio_egreso = ?`); posgradoParams.push(anio); }
    const posgradoWhere = `WHERE ${posgradoConditions.join(' AND ')}`;

    const posgradoGenero = await this.dataSource.query(`
      SELECT
        ${this.generoCase}                                                    AS genero,
        COUNT(*)                                                              AS total
      FROM egresados e
      LEFT JOIN generos g ON e.genero_id = g.id_genero
      ${posgradoWhere}
      GROUP BY g.genero
    `, posgradoParams);

    // ── 14. Posgrado por tipo y género ────────────────────────────────────
    const posgradoTipoGenero = await this.dataSource.query(`
      SELECT
        ${this.generoCase}                                                    AS genero,
        c.nombre_carrera                                                      AS tipo_posgrado,
        COUNT(*)                                                              AS total,
        ROUND(
          COUNT(*) * 100.0
          / SUM(COUNT(*)) OVER (PARTITION BY g.genero), 1
        )                                                                     AS porcentaje
      FROM egresados e
      LEFT JOIN generos  g ON e.genero_id  = g.id_genero
      LEFT JOIN carreras c ON e.carrera_id = c.id_carrera
      ${posgradoWhere}
      GROUP BY g.genero, c.nombre_carrera
      ORDER BY g.genero, total DESC
    `, posgradoParams);

    // ── 15. Nivel de inglés por género ────────────────────────────────────
    const inglesGenero = await this.dataSource.query(`
      SELECT
        ${this.generoCase}                                                    AS genero,
        ni.nivel,
        COUNT(*)                                                              AS total,
        ROUND(
          COUNT(*) * 100.0
          / SUM(COUNT(*)) OVER (PARTITION BY g.genero), 1
        )                                                                     AS porcentaje
      FROM egresados e
      LEFT JOIN generos        g  ON e.genero_id       = g.id_genero
      LEFT JOIN niveles_ingles ni ON e.nivel_ingles_id = ni.id_nivel
      LEFT JOIN carreras       c  ON e.carrera_id      = c.id_carrera
      ${where}
      GROUP BY g.genero, ni.nivel
      ORDER BY g.genero, total DESC
    `, params);

    // ── 16. Satisfacción académica por género ─────────────────────────────
    const satisfaccionGenero = await this.dataSource.query(`
      SELECT
        ${this.generoCase}                                                    AS genero,
        ROUND(AVG(e.satisfaccion_formacion), 2)                               AS promedio,
        COUNT(*)                                                              AS total,
        SUM(e.satisfaccion_formacion = 5)                                     AS muy_satisfecho,
        SUM(e.satisfaccion_formacion = 4)                                     AS satisfecho,
        SUM(e.satisfaccion_formacion = 3)                                     AS neutral,
        SUM(e.satisfaccion_formacion = 2)                                     AS insatisfecho,
        SUM(e.satisfaccion_formacion = 1)                                     AS muy_insatisfecho
      FROM egresados e
      LEFT JOIN generos  g ON e.genero_id  = g.id_genero
      LEFT JOIN carreras c ON e.carrera_id = c.id_carrera
      ${where}
      GROUP BY g.genero
    `, params);

    // ── 17. Habilidades que faltaron por género ───────────────────────────
    const habilidadesGenero = await this.dataSource.query(`
      SELECT
        ${this.generoCase}                                                    AS genero,
        h.habilidad,
        COUNT(*)                                                              AS total,
        ROUND(
          COUNT(*) * 100.0
          / SUM(COUNT(*)) OVER (PARTITION BY g.genero), 1
        )                                                                     AS porcentaje
      FROM egresado_habilidades eh
      JOIN egresados   e ON eh.id_egresado  = e.id_egresado
      JOIN habilidades h ON eh.id_habilidad = h.id_habilidad
      LEFT JOIN generos  g ON e.genero_id  = g.id_genero
      LEFT JOIN carreras c ON e.carrera_id = c.id_carrera
      ${where}
      GROUP BY g.genero, h.habilidad
      ORDER BY g.genero, total DESC
    `, params);

    return {
      kpisGenero,
      proporcionCarreraGenero,
      egresoAnioGenero,
      composicionCarreraGenero,
      empleabilidadGenero,
      sectorLaboralGenero,
      coincidenciaLaboralGenero,
      tiempoEmpleoGenero,
      geografiaGenero,
      topCiudadesGenero,
      titulacionGenero,
      titulacionAnioGenero,
      posgradoGenero,
      posgradoTipoGenero,
      inglesGenero,
      satisfaccionGenero,
      habilidadesGenero,
    };
  }

  // COMPARATIVAS — múltiples carreras en una sola llamada
  async getComparativas(carreras: string[]): Promise<any> {
    if (!carreras || carreras.length < 2 || carreras.length > 3) {
      throw new BadRequestException('Debes seleccionar entre 2 y 3 carreras.');
    }

    // Genera placeholders: ?, ?, ?
    const placeholders = carreras.map(() => '?').join(', ');

    // 1. Empleo por carrera
    const empleo = await this.dataSource.query(`
    SELECT
      c.nombre_carrera,
      COUNT(*)                                                             AS total,
      SUM(sl.situacion != 'Desempleado')                                   AS empleados,
      SUM(sl.situacion  = 'Desempleado')                                   AS desempleados,
      ROUND(SUM(sl.situacion != 'Desempleado') * 100.0 / COUNT(*), 1)      AS pct_empleados
    FROM egresados e
    LEFT JOIN carreras          c  ON e.carrera_id           = c.id_carrera
    LEFT JOIN situacion_laboral sl ON e.situacion_laboral_id = sl.id_situacion
    WHERE c.nombre_carrera IN (${placeholders})
    GROUP BY c.nombre_carrera
    ORDER BY pct_empleados DESC
  `, carreras);

    // 2. Titulación por carrera
    const titulacion = await this.dataSource.query(`
    SELECT
      c.nombre_carrera,
      COUNT(*)                                                                    AS total,
      SUM(e.estatus_titulacion = 'Titulado')                                      AS titulados,
      SUM(e.estatus_titulacion = 'En trámite')                                    AS en_tramite,
      SUM(e.estatus_titulacion = 'No titulado')                                   AS no_titulados,
      ROUND(SUM(e.estatus_titulacion = 'Titulado')    * 100.0 / COUNT(*), 1)      AS pct_titulados,
      ROUND(SUM(e.estatus_titulacion = 'En trámite')  * 100.0 / COUNT(*), 1)      AS pct_en_tramite,
      ROUND(SUM(e.estatus_titulacion = 'No titulado') * 100.0 / COUNT(*), 1)      AS pct_no_titulados
    FROM egresados e
    LEFT JOIN carreras c ON e.carrera_id = c.id_carrera
    WHERE c.nombre_carrera IN (${placeholders})
    GROUP BY c.nombre_carrera
    ORDER BY pct_titulados DESC
  `, carreras);

    // 3. Sector laboral × carrera  ← el gap que te faltaba
    const sectorCarrera = await this.dataSource.query(`
    SELECT
      c.nombre_carrera,
      sl.situacion                                                                AS sector,
      COUNT(*)                                                                    AS total,
      ROUND(
        COUNT(*) * 100.0
        / SUM(COUNT(*)) OVER (PARTITION BY c.nombre_carrera), 1
      )                                                                           AS porcentaje
    FROM egresados e
    LEFT JOIN carreras          c  ON e.carrera_id           = c.id_carrera
    LEFT JOIN situacion_laboral sl ON e.situacion_laboral_id = sl.id_situacion
    WHERE c.nombre_carrera IN (${placeholders})
    GROUP BY c.nombre_carrera, sl.situacion
    ORDER BY c.nombre_carrera, total DESC
  `, carreras);

    // 4. Nivel de inglés × carrera
    const ingles = await this.dataSource.query(`
    SELECT
      c.nombre_carrera,
      ni.nivel,
      COUNT(*)                                                                    AS total,
      ROUND(
        COUNT(*) * 100.0
        / SUM(COUNT(*)) OVER (PARTITION BY c.nombre_carrera), 1
      )                                                                           AS porcentaje
    FROM egresados e
    LEFT JOIN carreras      c  ON e.carrera_id       = c.id_carrera
    LEFT JOIN niveles_ingles ni ON e.nivel_ingles_id = ni.id_nivel
    WHERE c.nombre_carrera IN (${placeholders})
    GROUP BY c.nombre_carrera, ni.nivel
    ORDER BY c.nombre_carrera, total DESC
  `, carreras);

    // 5. Satisfacción de formación por carrera
    const satisfaccion = await this.dataSource.query(`
    SELECT
      c.nombre_carrera,
      ROUND(AVG(e.satisfaccion_formacion), 2)                                     AS promedio,
      ROUND(AVG(e.satisfaccion_formacion) * 20, 1)                                AS promedio_pct,
      COUNT(*)                                                                    AS total,
      SUM(e.satisfaccion_formacion = 5)                                           AS muy_satisfecho,
      SUM(e.satisfaccion_formacion = 4)                                           AS satisfecho,
      SUM(e.satisfaccion_formacion = 3)                                           AS neutral,
      SUM(e.satisfaccion_formacion = 2)                                           AS insatisfecho,
      SUM(e.satisfaccion_formacion = 1)                                           AS muy_insatisfecho
    FROM egresados e
    LEFT JOIN carreras c ON e.carrera_id = c.id_carrera
    WHERE c.nombre_carrera IN (${placeholders})
    GROUP BY c.nombre_carrera
    ORDER BY promedio DESC
  `, carreras);

    // 6. Migración × carrera  ← consolidado desde getDistribucionGeografica
    const migracion = await this.dataSource.query(`
    SELECT
      c.nombre_carrera,
      COUNT(*)                                                                    AS total,
      SUM(
        e.ciudad_trabajo LIKE 'Durango%'
        OR e.ciudad_trabajo IS NULL
        OR e.ciudad_trabajo = ''
      )                                                                           AS en_durango,
      SUM(
        e.ciudad_trabajo IS NOT NULL
        AND e.ciudad_trabajo != ''
        AND e.ciudad_trabajo NOT LIKE 'Durango%'
        AND TRIM(SUBSTRING_INDEX(e.ciudad_trabajo, ',', -1)) = 'México'
      )                                                                           AS fuera_durango_mexico,
      SUM(
        e.ciudad_trabajo IS NOT NULL
        AND e.ciudad_trabajo != ''
        AND TRIM(SUBSTRING_INDEX(e.ciudad_trabajo, ',', -1)) != 'México'
      )                                                                           AS en_extranjero,
      ROUND(
        SUM(
          e.ciudad_trabajo IS NOT NULL
          AND e.ciudad_trabajo != ''
          AND e.ciudad_trabajo NOT LIKE 'Durango%'
        ) * 100.0 / COUNT(*), 1
      )                                                                           AS pct_fuera_durango,
      ROUND(
        SUM(
          e.ciudad_trabajo IS NOT NULL
          AND e.ciudad_trabajo != ''
          AND TRIM(SUBSTRING_INDEX(e.ciudad_trabajo, ',', -1)) != 'México'
        ) * 100.0 / COUNT(*), 1
      )                                                                           AS pct_extranjero
    FROM egresados e
    LEFT JOIN carreras c ON e.carrera_id = c.id_carrera
    WHERE c.nombre_carrera IN (${placeholders})
    GROUP BY c.nombre_carrera
    ORDER BY pct_fuera_durango DESC
  `, carreras);

    // 7. Tiempo al primer empleo × carrera (distribución por rango)
    //    INNER JOIN excluye registros viejos sin el dato (NULL), así el
    //    porcentaje es sobre quienes sí respondieron la pregunta.
    const tiempoPrimerEmpleo = await this.dataSource.query(`
    SELECT
      c.nombre_carrera,
      tpe.id_tiempo,
      tpe.rango,
      COUNT(*)                                                                    AS total,
      ROUND(
        COUNT(*) * 100.0
        / SUM(COUNT(*)) OVER (PARTITION BY c.nombre_carrera), 1
      )                                                                           AS porcentaje
    FROM egresados e
    LEFT JOIN carreras c          ON e.carrera_id              = c.id_carrera
    JOIN tiempo_primer_empleo tpe ON e.tiempo_primer_empleo_id = tpe.id_tiempo
    WHERE c.nombre_carrera IN (${placeholders})
    GROUP BY c.nombre_carrera, tpe.id_tiempo, tpe.rango
    ORDER BY c.nombre_carrera ASC, tpe.id_tiempo ASC
  `, carreras);

    // 8. Medio del primer empleo × carrera
    //    INNER JOIN a medio_primer_empleo deja fuera a quien nunca se empleó
    //    (medio = NULL), así el % es sobre quienes obtuvieron empleo.
    const medioPrimerEmpleo = await this.dataSource.query(`
    SELECT
      c.nombre_carrera,
      mpe.id_medio,
      mpe.medio,
      mpe.orden,
      COUNT(*)                                                                    AS total,
      ROUND(
        COUNT(*) * 100.0
        / SUM(COUNT(*)) OVER (PARTITION BY c.nombre_carrera), 1
      )                                                                           AS porcentaje
    FROM egresados e
    LEFT JOIN carreras c         ON e.carrera_id             = c.id_carrera
    JOIN medio_primer_empleo mpe ON e.medio_primer_empleo_id = mpe.id_medio
    WHERE c.nombre_carrera IN (${placeholders})
    GROUP BY c.nombre_carrera, mpe.id_medio, mpe.medio, mpe.orden
    ORDER BY c.nombre_carrera ASC, mpe.orden ASC
  `, carreras);

    // 7. Resumen global — un objeto por carrera con todos los KPIs clave
    const resumen = await this.dataSource.query(`
    SELECT
      c.nombre_carrera,
      COUNT(*)                                                                    AS total,
      ROUND(SUM(sl.situacion != 'Desempleado') * 100.0 / COUNT(*), 1)            AS pct_empleados,
      ROUND(SUM(e.estatus_titulacion = 'Titulado') * 100.0 / COUNT(*), 1)        AS pct_titulados,
      ROUND(AVG(e.satisfaccion_formacion), 2)                                     AS satisfaccion_promedio,
      ROUND(
        SUM(
          e.ciudad_trabajo IS NOT NULL
          AND e.ciudad_trabajo != ''
          AND e.ciudad_trabajo NOT LIKE 'Durango%'
        ) * 100.0 / COUNT(*), 1
      )                                                                           AS pct_fuera_durango
    FROM egresados e
    LEFT JOIN carreras          c  ON e.carrera_id           = c.id_carrera
    LEFT JOIN situacion_laboral sl ON e.situacion_laboral_id = sl.id_situacion
    WHERE c.nombre_carrera IN (${placeholders})
    GROUP BY c.nombre_carrera
  `, carreras);

    return {
      carreras,
      resumen,
      empleo,
      titulacion,
      sectorCarrera,
      ingles,
      satisfaccion,
      migracion,
      tiempoPrimerEmpleo,
      medioPrimerEmpleo,
    };
  }

  // DIRECTORIO — paginado y filtrable
  async getDirectorioPublico(
    page: number = 1,
    limit: number = 24,
    busqueda?: string,
    carrera?: string,
    anio?: number,
    titulacion?: string,
  ): Promise<{ data: any[]; total: number }> {
    const take = Math.min(limit, 100);
    const skip = (page - 1) * take;

    const params: any[] = [];
    const conditions: string[] = ['1=1'];

    if (busqueda) {
      conditions.push(`e.nombre_completo LIKE ?`);
      params.push(`%${busqueda}%`);
    }
    if (carrera) {
      conditions.push(`c.nombre_carrera = ?`);
      params.push(carrera);
    }
    if (anio) {
      conditions.push(`e.anio_egreso = ?`);
      params.push(anio);
    }
    if (titulacion) {
      conditions.push(`e.estatus_titulacion = ?`);
      params.push(titulacion);
    }

    const where = `WHERE ${conditions.join(' AND ')}`;

    const [countResult, egresados] = await Promise.all([
      this.dataSource.query(`
        SELECT COUNT(*) AS total
        FROM egresados e
        LEFT JOIN carreras c ON e.carrera_id = c.id_carrera
        ${where}
      `, params),
      this.dataSource.query(`
        SELECT
          e.id_egresado,
          e.nombre_completo,
          e.foto_url,
          e.ciudad_residencia,
          e.ciudad_trabajo,
          e.empresa,
          e.puesto_trabajo,
          e.estatus_titulacion,
          e.anio_egreso,
          e.linkedin,
          c.nombre_carrera,
          g.genero,
          ni.nivel       AS nivel_ingles,
          sl.situacion   AS sector_trabajo,
          ae.rango       AS antiguedad_empleo,
          cl.nivel       AS coincidencia_laboral
        FROM egresados e
        LEFT JOIN carreras             c   ON e.carrera_id              = c.id_carrera
        LEFT JOIN generos              g   ON e.genero_id               = g.id_genero
        LEFT JOIN niveles_ingles       ni  ON e.nivel_ingles_id         = ni.id_nivel
        LEFT JOIN situacion_laboral    sl  ON e.situacion_laboral_id    = sl.id_situacion
        LEFT JOIN antiguedad_empleo    ae  ON e.antiguedad_empleo_id    = ae.id_antiguedad
        LEFT JOIN coincidencia_laboral cl  ON e.coincidencia_laboral_id = cl.id_coincidencia
        ${where}
        ORDER BY e.nombre_completo ASC
        LIMIT ? OFFSET ?
      `, [...params, take, skip]),
    ]);

    for (const eg of egresados) {
      const [certs, colabs] = await Promise.all([
        this.dataSource.query(
          `SELECT nombre_certificacion FROM certificaciones WHERE id_egresado = ?`,
          [eg.id_egresado],
        ),
        this.dataSource.query(`
          SELECT col.descripcion
          FROM egresado_colaboraciones ec
          JOIN colaboraciones col ON ec.id_colaboracion = col.id_colaboracion
          WHERE ec.id_egresado = ?
        `, [eg.id_egresado]),
      ]);
      eg.certificaciones = certs.map((r: any) => r.nombre_certificacion);
      eg.interes_colaborar = colabs.map((r: any) => r.descripcion);
    }

    return { data: egresados, total: Number(countResult[0].total) };
  }

  // FILTROS DISPONIBLES para los dropdowns del directorio
  async getFiltrosDirectorio(): Promise<{ carreras: string[]; anios: number[] }> {
    const [carrerasRows, aniosRows] = await Promise.all([
      this.dataSource.query(`
        SELECT DISTINCT c.nombre_carrera
        FROM egresados e
        JOIN carreras c ON e.carrera_id = c.id_carrera
        ORDER BY c.nombre_carrera ASC
      `),
      this.dataSource.query(`
        SELECT DISTINCT e.anio_egreso
        FROM egresados e
        ORDER BY e.anio_egreso DESC
      `),
    ]);

    return {
      carreras: carrerasRows.map((r: any) => r.nombre_carrera),
      anios: aniosRows.map((r: any) => Number(r.anio_egreso)),
    };
  }

  async getVinculacionCarreras(): Promise<string[]> {
    const rows = await this.dataSource.query(`
      SELECT DISTINCT c.nombre_carrera
      FROM egresados e
      JOIN carreras c ON e.carrera_id = c.id_carrera
      ORDER BY c.nombre_carrera ASC
    `);
    return rows.map((r: any) => r.nombre_carrera);
  }

  async getVinculacionAnios(): Promise<number[]> {
    const rows = await this.dataSource.query(`
      SELECT DISTINCT anio_egreso
      FROM egresados
      ORDER BY anio_egreso DESC
    `);
    return rows.map((r: any) => Number(r.anio_egreso));
  }

  async marcarRevisado(
    id: number,
    revisado: boolean,
    revisadoPor: string,
  ): Promise<{ mensaje: string }> {

    const existe = await this.egresadosRepo.findOne({ where: { id_egresado: id } });
    if (!existe) {
      throw new NotFoundException(`No se encontró el egresado con id ${id}.`);
    }

    await this.dataSource.query(
      `UPDATE egresados
        SET revisado       = ?,
            fecha_revision = ?,
            revisado_por   = ?
      WHERE id_egresado    = ?`,
      [
        revisado ? 1 : 0,
        revisado ? new Date() : null,
        revisado ? revisadoPor : null,
        id,
      ],
    );

    return {
      mensaje: revisado
        ? 'Respuesta marcada como revisada.'
        : 'Revisión removida correctamente.',
    };
  }

  async getPendientesRevision(): Promise<{ total: number; egresados: any[] }> {
    const rows = await this.dataSource.query(`
    SELECT
      e.id_egresado, e.nombre_completo, e.fecha_registro,
      c.nombre_carrera, e.foto_url
    FROM egresados e
    LEFT JOIN carreras c ON e.carrera_id = c.id_carrera
    WHERE e.revisado = 0
    ORDER BY e.fecha_registro DESC
    LIMIT 10
  `);

    const [{ total }] = await this.dataSource.query(
      `SELECT COUNT(*) AS total FROM egresados WHERE revisado = 0`,
    );

    return { total: Number(total), egresados: rows };
  }
}