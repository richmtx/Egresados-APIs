import {
  BadRequestException, ConflictException, Injectable, Logger, NotFoundException,
} from '@nestjs/common';
import { DataSource, QueryRunner } from 'typeorm';
import { UsuariosService } from '../usuarios/usuarios.service';
import { claveEmpresaSql, COLLATE_VARIANTE } from '../common/constants/normalizacion-empresa';
import { EstadoCandidatoEmpresa, ListarCandidatosEmpresaDto } from './dto/listar-candidatos-empresa.dto';
import { ListarEmpresasDto } from './dto/listar-empresas.dto';
import { FusionarEmpresasDto } from './dto/fusionar-empresas.dto';

// ─────────────────────────────────────────────────────────────────────────────
// NORMALIZACIÓN DE NOMBRES DE EMPRESAS (migración 013)
//
// Reglas de este servicio:
//  · Los textos egresados.empresa y egresados.primer_empleo_empresa NUNCA se
//    modifican: conservan lo que escribió la persona. La normalización solo
//    llena las FK empresa_id y primer_empleo_empresa_id.
//  · El detector solo PROPONE variantes en empresas_candidatos. Nunca liga
//    egresados por su cuenta: eso solo lo hace fusionar, a petición de un admin.
//  · empresas.nombre_clave es STORED GENERATED: solo se LEE. Incluirla en un
//    INSERT o UPDATE truena con el error 3105.
//  · CHECK chk_cand_revision: 'pendiente' exige revisado_por y revisado_en en
//    NULL; 'fusionado' y 'descartado' los exigen NOT NULL (error 3819). Por
//    eso el estado y los datos de revisión siempre se escriben juntos.
//  · La clave se calcula SIEMPRE con claveEmpresaSql(): la misma expresión de
//    la columna generada. Las claves se comparan con la colación de la base
//    (utf8mb4_0900_ai_ci: 'méxico' = 'mexico'); las variantes, con
//    COLLATE_VARIANTE (cada texto crudo es una variante distinta).
//  · Una decisión del administrador (fusionado / descartado) nunca se pisa al
//    re-ejecutar el detector.
//  · mysql2 devuelve COUNT()/SUM() como string: todo agregado pasa por Number().
// ─────────────────────────────────────────────────────────────────────────────

const TAM_LOTE = 500;

// Colación de las columnas de texto: con ella se agrupan las claves.
const COLLATE_CLAVE = 'utf8mb4_0900_ai_ci';

interface VarianteDetectada {
  variante: string;
  clave: string;
  ocurrencias_empresa: number;
  ocurrencias_primer_empleo: number;
}

// Orden del nombre sugerido: más ocurrencias totales; si empatan, la más
// corta; si siguen empatadas, la primera alfabéticamente. La última
// comparación (por código de carácter) solo desempata textos que el orden
// alfabético considera iguales, para que el resultado sea determinista.
const ordenSugerido = (x: VarianteDetectada, y: VarianteDetectada) =>
  (y.ocurrencias_empresa + y.ocurrencias_primer_empleo) - (x.ocurrencias_empresa + x.ocurrencias_primer_empleo)
  || x.variante.length - y.variante.length
  || x.variante.localeCompare(y.variante, 'es')
  || (x.variante < y.variante ? -1 : x.variante > y.variante ? 1 : 0);

const escaparLike = (s: string) => s.replace(/[\\%_]/g, c => `\\${c}`);

@Injectable()
export class EmpresasService {

  private readonly logger = new Logger(EmpresasService.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly usuariosService: UsuariosService,
  ) { }

  // Auditoría posterior al commit. Si falla, la operación ya es efectiva.
  private async auditar(idAdmin: number, accion: string, descripcion: string) {
    try {
      await this.usuariosService.registrarAccion(idAdmin, accion, descripcion, 'empresas');
    } catch (err) {
      this.logger.error(
        `Acción ${accion} aplicada pero falló el registro de auditoría`,
        err instanceof Error ? err.stack : String(err),
      );
    }
  }

  // Grupos (claves) con más de un texto distinto dentro de UNA columna.
  // Sin el COLLATE, MySQL considera 'Softtek' y 'SOFTTEK' el mismo valor y el
  // grupo nunca aparece.
  private async contarGrupos(columna: 'empresa' | 'primer_empleo_empresa'): Promise<number> {
    const [fila] = await this.dataSource.query(`
      SELECT COUNT(*) AS total FROM (
        SELECT ${claveEmpresaSql(columna)} AS clave
        FROM egresados
        WHERE ${columna} IS NOT NULL AND ${claveEmpresaSql(columna)} <> ''
        GROUP BY clave
        HAVING COUNT(DISTINCT ${columna} COLLATE ${COLLATE_VARIANTE}) > 1
      ) g
    `);
    return Number(fila?.total ?? 0);
  }

  // 1. DETECTAR
  // Junta los textos de las DOS columnas, los agrupa por clave normalizada y
  // se queda con los grupos que tienen más de un texto distinto. Un grupo
  // puede cruzar columnas ('Softtek' en empresa y 'SOFTTEK' en primer empleo
  // son dos variantes de la misma clave): cada variante es UNA fila con sus
  // dos contadores.
  async detectar(idAdmin: number) {
    // Una fila por variante. clave_grupo es la misma cadena para todo el
    // grupo (las claves 'grupo méxico' y 'grupo mexico' son iguales para la
    // base, pero no para JavaScript).
    const filas: any[] = await this.dataSource.query(`
      SELECT v.variante, v.oc_empresa, v.oc_primer,
             MIN(v.clave COLLATE ${COLLATE_VARIANTE})
               OVER (PARTITION BY v.clave COLLATE ${COLLATE_CLAVE}) AS clave_grupo,
             COUNT(*) OVER (PARTITION BY v.clave COLLATE ${COLLATE_CLAVE}) AS variantes_grupo
      FROM (
        SELECT t.variante, MIN(t.clave) AS clave,
               SUM(t.oc_empresa) AS oc_empresa, SUM(t.oc_primer) AS oc_primer
        FROM (
          SELECT empresa COLLATE ${COLLATE_VARIANTE} AS variante,
                 ${claveEmpresaSql('empresa')} AS clave,
                 1 AS oc_empresa, 0 AS oc_primer
          FROM egresados
          WHERE empresa IS NOT NULL
          UNION ALL
          SELECT primer_empleo_empresa COLLATE ${COLLATE_VARIANTE},
                 ${claveEmpresaSql('primer_empleo_empresa')},
                 0, 1
          FROM egresados
          WHERE primer_empleo_empresa IS NOT NULL
        ) t
        GROUP BY t.variante
      ) v
      WHERE v.clave <> ''
    `);

    const porClave = new Map<string, VarianteDetectada[]>();
    for (const f of filas) {
      if (Number(f.variantes_grupo) < 2) continue;
      const v: VarianteDetectada = {
        variante: f.variante,
        clave: f.clave_grupo,
        ocurrencias_empresa: Number(f.oc_empresa),
        ocurrencias_primer_empleo: Number(f.oc_primer),
      };
      if (!porClave.has(v.clave)) porClave.set(v.clave, []);
      porClave.get(v.clave)!.push(v);
    }

    const detectadas: (VarianteDetectada & { sugerido: string })[] = [];
    for (const variantes of porClave.values()) {
      const sugerido = [...variantes].sort(ordenSugerido)[0].variante;
      for (const v of variantes) detectadas.push({ ...v, sugerido });
    }

    let nuevas = 0;
    let actualizadas = 0;
    let respetadas = 0;
    let eliminadas = 0;

    const qr = this.dataSource.createQueryRunner();
    await qr.connect();
    await qr.startTransaction();
    try {
      const existentes: { id_empresa_candidato: number; nombre_variante: string; estado: EstadoCandidatoEmpresa }[] =
        await qr.query(`
          SELECT id_empresa_candidato, nombre_variante, estado
          FROM empresas_candidatos
          FOR UPDATE
        `);
      const estadoPorVariante = new Map(existentes.map(e => [e.nombre_variante, e.estado]));

      for (const d of detectadas) {
        const estado = estadoPorVariante.get(d.variante);
        if (estado === undefined) nuevas++;
        else if (estado === 'pendiente') actualizadas++;
        else respetadas++;
      }

      // Una variante que ya existe solo refresca contadores y datos derivados
      // (clave, sugerido). estado, empresa_id, revisado_por y revisado_en no
      // se asignan: una variante ya revisada conserva su decisión.
      for (let i = 0; i < detectadas.length; i += TAM_LOTE) {
        const lote = detectadas.slice(i, i + TAM_LOTE);
        const params: (string | number)[] = [];
        for (const d of lote) {
          params.push(d.clave, d.variante, d.sugerido, d.ocurrencias_empresa, d.ocurrencias_primer_empleo);
        }
        await qr.query(
          `INSERT INTO empresas_candidatos
             (nombre_clave, nombre_variante, nombre_sugerido,
              ocurrencias_empresa, ocurrencias_primer_empleo)
           VALUES ${lote.map(() => '(?, ?, ?, ?, ?)').join(', ')}
           ON DUPLICATE KEY UPDATE
             nombre_clave              = VALUES(nombre_clave),
             nombre_sugerido           = VALUES(nombre_sugerido),
             ocurrencias_empresa       = VALUES(ocurrencias_empresa),
             ocurrencias_primer_empleo = VALUES(ocurrencias_primer_empleo),
             detectado_en              = IF(estado = 'pendiente', NOW(), detectado_en)`,
          params,
        );
      }

      // Pendientes fantasma: estaban guardados pero esta corrida ya no los
      // produjo (se borró al egresado, o el grupo se quedó con un solo texto).
      // El AND estado = 'pendiente' del DELETE es la segunda red.
      const variantesCorrida = new Set(detectadas.map(d => d.variante));
      const obsoletos = existentes
        .filter(e => e.estado === 'pendiente' && !variantesCorrida.has(e.nombre_variante))
        .map(e => Number(e.id_empresa_candidato));
      for (let i = 0; i < obsoletos.length; i += TAM_LOTE) {
        const res = await qr.query(
          `DELETE FROM empresas_candidatos
           WHERE estado = 'pendiente' AND id_empresa_candidato IN (?)`,
          [obsoletos.slice(i, i + TAM_LOTE)],
        );
        eliminadas += Number(res?.affectedRows ?? 0);
      }

      await qr.commitTransaction();
    } catch (err) {
      if (qr.isTransactionActive) await qr.rollbackTransaction();
      throw err;
    } finally {
      await qr.release();
    }

    const [pend] = await this.dataSource.query(
      `SELECT COUNT(*) AS total FROM empresas_candidatos WHERE estado = 'pendiente'`,
    );

    const resumen = {
      grupos: porClave.size,
      grupos_empresa: await this.contarGrupos('empresa'),
      grupos_primer_empleo: await this.contarGrupos('primer_empleo_empresa'),
      variantes: detectadas.length,
      variantes_nuevas: nuevas,
      variantes_actualizadas: actualizadas,
      variantes_respetadas: respetadas,
      variantes_eliminadas: eliminadas,
      total_pendientes: Number(pend?.total ?? 0),
    };

    await this.auditar(
      idAdmin,
      'detectar_empresas',
      `Ejecutó la detección de variantes de empresa: ${resumen.grupos} grupo(s), ${nuevas} variante(s) nueva(s)`,
    );

    return resumen;
  }

  // 2. CANDIDATOS agrupados por nombre_clave. clave_grupo unifica las claves
  // que la base considera iguales, igual que en detectar.
  async listarCandidatos(query: ListarCandidatosEmpresaDto) {
    const estado = query.estado ?? 'pendiente';

    const filas: any[] = await this.dataSource.query(`
      SELECT c.id_empresa_candidato, c.nombre_variante, c.nombre_sugerido,
             c.ocurrencias_empresa, c.ocurrencias_primer_empleo, c.estado,
             c.empresa_id, e.nombre AS empresa_nombre,
             c.detectado_en, c.revisado_por, c.revisado_en,
             MIN(c.nombre_clave COLLATE ${COLLATE_VARIANTE})
               OVER (PARTITION BY c.nombre_clave COLLATE ${COLLATE_CLAVE}) AS clave_grupo
      FROM empresas_candidatos c
      LEFT JOIN empresas e ON e.id_empresa = c.empresa_id
      WHERE c.estado = ?
      ORDER BY (c.ocurrencias_empresa + c.ocurrencias_primer_empleo) DESC, c.id_empresa_candidato
    `, [estado]);

    const porClave = new Map<string, { nombre_clave: string; nombre_sugerido: string; total_ocurrencias: number; variantes: any[] }>();
    for (const f of filas) {
      if (!porClave.has(f.clave_grupo)) {
        // La primera fila del grupo es la de más ocurrencias: su sugerido manda.
        porClave.set(f.clave_grupo, {
          nombre_clave: f.clave_grupo,
          nombre_sugerido: f.nombre_sugerido,
          total_ocurrencias: 0,
          variantes: [],
        });
      }
      const g = porClave.get(f.clave_grupo)!;
      const ocEmpresa = Number(f.ocurrencias_empresa);
      const ocPrimer = Number(f.ocurrencias_primer_empleo);
      g.total_ocurrencias += ocEmpresa + ocPrimer;
      g.variantes.push({
        id_empresa_candidato: Number(f.id_empresa_candidato),
        nombre_variante: f.nombre_variante,
        ocurrencias_empresa: ocEmpresa,
        ocurrencias_primer_empleo: ocPrimer,
        estado: f.estado as EstadoCandidatoEmpresa,
        empresa_id: f.empresa_id === null ? null : Number(f.empresa_id),
        empresa_nombre: f.empresa_nombre ?? null,
        detectado_en: f.detectado_en,
        revisado_por: f.revisado_por ?? null,
        revisado_en: f.revisado_en ?? null,
      });
    }

    const grupos = [...porClave.values()].sort(
      (x, y) => y.total_ocurrencias - x.total_ocurrencias
        || (x.nombre_clave < y.nombre_clave ? -1 : x.nombre_clave > y.nombre_clave ? 1 : 0),
    );

    return { grupos, total: grupos.length };
  }

  // 3. FUSIONAR — liga a un nombre canónico todos los egresados que
  // escribieron alguna de las variantes. Todo va en una transacción: o se
  // ligan las dos columnas y se marcan los candidatos, o no se toca nada.
  //
  // NO se valida que las variantes compartan nombre_clave. Es intencional:
  // hay casos que ninguna regla de texto agrupa (CFE / Comisión Federal de
  // Electricidad, Grupo Lala / Lala, Softek con una sola t) y el
  // administrador los fusiona a mano.
  async fusionar(dto: FusionarEmpresasDto, revisadoPor: string, idAdmin: number) {
    const nombreCanonico = dto.nombre_canonico.trim();
    // Las variantes NO se recortan: '  John Deere  ' es un texto crudo válido.
    const variantes = [...new Set(dto.variantes)];

    let idEmpresa: number;
    let nombreEmpresa: string;
    let empresaCreada = false;
    let ligadosEmpresa = 0;
    let ligadosPrimerEmpleo = 0;
    let candidatosActualizados = 0;
    let candidatosInsertados = 0;

    const qr = this.dataSource.createQueryRunner();
    await qr.connect();
    await qr.startTransaction();
    try {
      // Por cada variante: su clave, cuántos egresados la escribieron en cada
      // columna y si ya tiene fila de candidato. `idx` regresa cada fila a su
      // variante sin depender de comparar cadenas en JavaScript.
      const datos: any[] = await qr.query(
        variantes.map(() => `
          SELECT ? AS idx,
                 ${claveEmpresaSql('?')} AS clave,
                 (SELECT COUNT(*) FROM egresados
                  WHERE empresa COLLATE ${COLLATE_VARIANTE} = ?) AS oc_empresa,
                 (SELECT COUNT(*) FROM egresados
                  WHERE primer_empleo_empresa COLLATE ${COLLATE_VARIANTE} = ?) AS oc_primer,
                 (SELECT COUNT(*) FROM empresas_candidatos
                  WHERE nombre_variante = ?) AS es_candidato`).join(' UNION ALL '),
        variantes.flatMap((v, i) => [i, v, v, v, v]),
      );
      const info = datos
        .map(d => ({
          variante: variantes[Number(d.idx)],
          clave: String(d.clave ?? ''),
          oc_empresa: Number(d.oc_empresa),
          oc_primer: Number(d.oc_primer),
          es_candidato: Number(d.es_candidato) > 0,
        }));

      // Un texto que nadie escribió y que el detector nunca vio es un error
      // de captura del cliente, no una variante.
      const desconocidas = info.filter(d => d.oc_empresa + d.oc_primer === 0 && !d.es_candidato);
      if (desconocidas.length > 0) {
        throw new BadRequestException(
          `Ningún egresado tiene registrada la empresa: ${desconocidas.map(d => `"${d.variante}"`).join(', ')}. `
          + 'Las variantes deben ir escritas exactamente como están en los registros. No se fusionó nada.',
        );
      }

      // a) Canónico: se reutiliza la fila cuya nombre_clave coincide; si no
      // hay, se inserta SOLO `nombre` (nombre_clave la genera la base).
      const [canon] = await qr.query(`SELECT ${claveEmpresaSql('?')} AS clave`, [nombreCanonico]);
      if (!canon?.clave) {
        throw new BadRequestException('nombre_canonico queda vacío al normalizarlo.');
      }
      const buscarEmpresa = () => qr.query(
        `SELECT id_empresa, nombre FROM empresas
         WHERE nombre_clave = ${claveEmpresaSql('?')}
         FOR UPDATE`,
        [nombreCanonico],
      );
      let [empresa] = await buscarEmpresa();
      if (!empresa) {
        try {
          const insert = await qr.query(`INSERT INTO empresas (nombre) VALUES (?)`, [nombreCanonico]);
          empresa = { id_empresa: insert.insertId, nombre: nombreCanonico };
          empresaCreada = true;
        } catch (err: any) {
          // 1062: otra petición insertó la misma clave entre el SELECT y el INSERT.
          if (err?.code !== 'ER_DUP_ENTRY' && err?.driverError?.code !== 'ER_DUP_ENTRY') throw err;
          [empresa] = await buscarEmpresa();
          if (!empresa) throw err;
        }
      }
      idEmpresa = Number(empresa.id_empresa);
      nombreEmpresa = empresa.nombre;

      // b) y c) Solo las FK. Los textos no se tocan.
      await qr.query(
        `UPDATE egresados SET empresa_id = ?
         WHERE empresa COLLATE ${COLLATE_VARIANTE} IN (?)`,
        [idEmpresa, variantes],
      );
      await qr.query(
        `UPDATE egresados SET primer_empleo_empresa_id = ?
         WHERE primer_empleo_empresa COLLATE ${COLLATE_VARIANTE} IN (?)`,
        [idEmpresa, variantes],
      );

      const [ligados] = await qr.query(
        `SELECT
           (SELECT COUNT(*) FROM egresados
            WHERE empresa_id = ? AND empresa COLLATE ${COLLATE_VARIANTE} IN (?)) AS empresa,
           (SELECT COUNT(*) FROM egresados
            WHERE primer_empleo_empresa_id = ?
              AND primer_empleo_empresa COLLATE ${COLLATE_VARIANTE} IN (?)) AS primer_empleo`,
        [idEmpresa, variantes, idEmpresa, variantes],
      );
      ligadosEmpresa = Number(ligados?.empresa ?? 0);
      ligadosPrimerEmpleo = Number(ligados?.primer_empleo ?? 0);

      // d) Candidatos: los que existen pasan a 'fusionado'; una variante sin
      // fila (fusión manual) se inserta ya fusionada. estado, revisado_por y
      // revisado_en van siempre juntos por el CHECK chk_cand_revision.
      const params: (string | number)[] = [];
      for (const d of info) {
        params.push(d.clave, d.variante, nombreEmpresa, d.oc_empresa, d.oc_primer, idEmpresa, revisadoPor);
      }
      await qr.query(
        `INSERT INTO empresas_candidatos
           (nombre_clave, nombre_variante, nombre_sugerido,
            ocurrencias_empresa, ocurrencias_primer_empleo,
            estado, empresa_id, revisado_por, revisado_en)
         VALUES ${info.map(() => `(?, ?, ?, ?, ?, 'fusionado', ?, ?, NOW())`).join(', ')}
         ON DUPLICATE KEY UPDATE
           ocurrencias_empresa       = VALUES(ocurrencias_empresa),
           ocurrencias_primer_empleo = VALUES(ocurrencias_primer_empleo),
           estado                    = 'fusionado',
           empresa_id                = VALUES(empresa_id),
           revisado_por              = VALUES(revisado_por),
           revisado_en               = NOW()`,
        params,
      );
      candidatosActualizados = info.filter(d => d.es_candidato).length;
      candidatosInsertados = info.length - candidatosActualizados;

      await qr.commitTransaction();
    } catch (err) {
      if (qr.isTransactionActive) await qr.rollbackTransaction();
      throw err;
    } finally {
      await qr.release();
    }

    // e) Historial
    await this.auditar(
      idAdmin,
      'fusionar_empresas',
      `Fusionó ${variantes.length} variante(s) en la empresa "${nombreEmpresa}" (${idEmpresa}): `
      + `${ligadosEmpresa} egresado(s) por empresa actual, ${ligadosPrimerEmpleo} por primer empleo`,
    );

    return {
      mensaje: `Se fusionaron ${variantes.length} variante(s) en "${nombreEmpresa}".`,
      empresa: { id_empresa: idEmpresa, nombre: nombreEmpresa, creada: empresaCreada },
      egresados_ligados: { empresa: ligadosEmpresa, primer_empleo: ligadosPrimerEmpleo },
      candidatos_actualizados: candidatosActualizados,
      candidatos_insertados: candidatosInsertados,
    };
  }

  // 4. DESCARTAR — la variante no es la misma empresa. No borra nada: deja de
  // aparecer como pendiente y el detector ya no la reactiva.
  async descartar(id: number, revisadoPor: string, idAdmin: number) {
    const qr = this.dataSource.createQueryRunner();
    await qr.connect();
    await qr.startTransaction();
    let candidato: any;
    try {
      [candidato] = await qr.query(
        `SELECT id_empresa_candidato, nombre_variante, estado
         FROM empresas_candidatos
         WHERE id_empresa_candidato = ? FOR UPDATE`,
        [id],
      );
      if (!candidato) throw new NotFoundException('Candidato de empresa no encontrado.');
      if (candidato.estado === 'descartado') {
        throw new ConflictException('Esta variante ya estaba descartada.');
      }
      // Descartarla dejaría egresados ligados a una empresa sin candidato que
      // lo explique.
      if (candidato.estado === 'fusionado') {
        throw new ConflictException('Esta variante ya fue fusionada; no se puede descartar.');
      }

      await qr.query(
        `UPDATE empresas_candidatos
         SET estado = 'descartado', revisado_por = ?, revisado_en = NOW()
         WHERE id_empresa_candidato = ?`,
        [revisadoPor, id],
      );
      await qr.commitTransaction();
    } catch (err) {
      if (qr.isTransactionActive) await qr.rollbackTransaction();
      throw err;
    } finally {
      await qr.release();
    }

    await this.auditar(
      idAdmin,
      'descartar_empresa',
      `Descartó la variante de empresa "${candidato.nombre_variante}"`,
    );

    return { mensaje: 'Variante descartada.', id_empresa_candidato: id };
  }

  // 5. CATÁLOGO canónico, con los egresados ligados por cada columna.
  async listar(query: ListarEmpresasDto) {
    const busqueda = query.busqueda?.trim();
    const where = busqueda ? 'WHERE e.nombre LIKE ?' : '';
    const params = busqueda ? [`%${escaparLike(busqueda)}%`] : [];

    const filas: any[] = await this.dataSource.query(`
      SELECT e.id_empresa, e.nombre, e.nombre_clave, e.activo, e.creado_en,
             (SELECT COUNT(*) FROM egresados g WHERE g.empresa_id = e.id_empresa) AS egresados_empresa,
             (SELECT COUNT(*) FROM egresados g
              WHERE g.primer_empleo_empresa_id = e.id_empresa) AS egresados_primer_empleo
      FROM empresas e
      ${where}
      ORDER BY e.nombre, e.id_empresa
    `, params);

    const empresas = filas.map(f => ({
      id_empresa: Number(f.id_empresa),
      nombre: f.nombre,
      nombre_clave: f.nombre_clave,
      activo: Number(f.activo) === 1,
      creado_en: f.creado_en,
      egresados_empresa: Number(f.egresados_empresa),
      egresados_primer_empleo: Number(f.egresados_primer_empleo),
    }));

    return { empresas, total: empresas.length };
  }

  // 6. ELIMINAR del catálogo, solo si nadie está ligado. Sin cascada: las FK
  // de egresados son ON DELETE SET NULL y aquí no se llega a usarlas.
  async eliminar(idEmpresa: number, idAdmin: number) {
    const qr = this.dataSource.createQueryRunner();
    await qr.connect();
    await qr.startTransaction();
    let empresa: any;
    try {
      [empresa] = await qr.query(
        `SELECT id_empresa, nombre FROM empresas WHERE id_empresa = ? FOR UPDATE`,
        [idEmpresa],
      );
      if (!empresa) throw new NotFoundException('Empresa no encontrada.');

      const ligados = await this.contarLigados(qr, idEmpresa);
      if (ligados.empresa + ligados.primer_empleo > 0) {
        throw new ConflictException(
          `No se puede eliminar "${empresa.nombre}": tiene ${ligados.empresa} egresado(s) ligado(s) `
          + `por empresa actual y ${ligados.primer_empleo} por primer empleo.`,
        );
      }

      await qr.query(`DELETE FROM empresas WHERE id_empresa = ?`, [idEmpresa]);
      await qr.commitTransaction();
    } catch (err) {
      if (qr.isTransactionActive) await qr.rollbackTransaction();
      throw err;
    } finally {
      await qr.release();
    }

    await this.auditar(idAdmin, 'eliminar_empresa', `Eliminó del catálogo la empresa "${empresa.nombre}" (${idEmpresa})`);

    return { mensaje: 'Empresa eliminada del catálogo.', id_empresa: idEmpresa };
  }

  private async contarLigados(qr: QueryRunner, idEmpresa: number) {
    const [fila] = await qr.query(
      `SELECT
         (SELECT COUNT(*) FROM egresados WHERE empresa_id = ?) AS empresa,
         (SELECT COUNT(*) FROM egresados WHERE primer_empleo_empresa_id = ?) AS primer_empleo`,
      [idEmpresa, idEmpresa],
    );
    return { empresa: Number(fila?.empresa ?? 0), primer_empleo: Number(fila?.primer_empleo ?? 0) };
  }
}
