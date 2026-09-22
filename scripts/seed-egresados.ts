/**
 * scripts/seed-egresados.ts
 *
 * Seed de datos ficticios para desarrollo local: borra todos los egresados
 * actuales y genera 500 registros deterministas que respetan las mismas
 * reglas que aplica el formulario público (ver crearEtapa1 / completarEtapa2
 * en src/egresados/egresados.service.ts).
 *
 * Uso:
 *   npm run seed                → modo simulación (no toca la base de datos)
 *   npm run seed -- --confirmar → aplica los cambios
 *
 * Fuera de src/: no se compila con la app, se corre con ts-node.
 */
import 'dotenv/config';
import * as mysql from 'mysql2/promise';
import { writeFileSync } from 'fs';
import { join } from 'path';

// ═══════════════════════════════════════════════════════════════════════
// PRNG determinista (mulberry32) — misma semilla ⇒ mismos datos siempre.
// ═══════════════════════════════════════════════════════════════════════
const SEMILLA = 2026;

function mulberry32(seed: number) {
  let t = seed >>> 0;
  return function (): number {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

class Rng {
  private next: () => number;
  constructor(seed: number) {
    this.next = mulberry32(seed);
  }
  float(): number {
    return this.next();
  }
  int(min: number, max: number): number {
    // inclusive
    return Math.floor(this.next() * (max - min + 1)) + min;
  }
  bool(pTrue: number): boolean {
    return this.next() < pTrue;
  }
  pick<T>(arr: readonly T[]): T {
    return arr[Math.floor(this.next() * arr.length)];
  }
  pickWeighted<T>(pares: [T, number][]): T {
    const total = pares.reduce((s, [, w]) => s + w, 0);
    let r = this.next() * total;
    for (const [item, w] of pares) {
      if (r < w) return item;
      r -= w;
    }
    return pares[pares.length - 1][0];
  }
  sample<T>(arr: readonly T[], n: number): T[] {
    const copia = [...arr];
    const resultado: T[] = [];
    n = Math.min(n, copia.length);
    for (let i = 0; i < n; i++) {
      const idx = Math.floor(this.next() * copia.length);
      resultado.push(copia[idx]);
      copia.splice(idx, 1);
    }
    return resultado;
  }
}

const rng = new Rng(SEMILLA);

// Fecha ancla fija: NO usar new Date() para reglas de negocio (últimos 12
// meses, año máximo, etc.) — así dos corridas producen exactamente lo mismo
// sin importar en qué día real se ejecuten.
const HOY = new Date('2026-09-22T12:00:00Z');
const ANIO_ACTUAL = HOY.getFullYear();

function sumarDias(fecha: Date, dias: number): Date {
  return new Date(fecha.getTime() + dias * 24 * 60 * 60 * 1000);
}

function fechaAleatoriaEntre(desde: Date, hasta: Date): Date {
  const t = rng.int(desde.getTime(), hasta.getTime());
  return new Date(t);
}

function quitarAcentos(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '');
}

// ═══════════════════════════════════════════════════════════════════════
// Datos de referencia (listas propias — sin dependencias nuevas)
// ═══════════════════════════════════════════════════════════════════════

const NOMBRES_F = [
  'María Fernanda', 'María José', 'Ana Karen', 'Andrea', 'Alejandra',
  'Guadalupe', 'Daniela', 'Fernanda', 'Jimena', 'Valeria', 'Paola', 'Karla',
  'Cecilia', 'Mariana', 'Diana', 'Gabriela', 'Brenda', 'Yesenia', 'Itzel',
  'Perla', 'Lizeth', 'Rocío', 'Adriana', 'Verónica', 'Claudia', 'Elizabeth',
  'Martha', 'Patricia', 'Leslie', 'Ximena', 'Montserrat', 'Estefanía',
  'Jocelyn', 'Nayeli', 'Araceli', 'Beatriz', 'Carolina', 'Denisse',
  'Eréndira', 'Sofía',
];

const NOMBRES_M = [
  'José Luis', 'Juan Carlos', 'Carlos Alberto', 'Luis Fernando',
  'Miguel Ángel', 'José Manuel', 'Francisco Javier', 'Jesús Alberto',
  'Roberto Carlos', 'Jorge Alberto', 'Alejandro', 'Ricardo', 'Eduardo',
  'Gerardo', 'Oscar', 'Iván', 'Sergio', 'Daniel', 'Emmanuel', 'Rodrigo',
  'Diego', 'Adrián', 'Fernando', 'Arturo', 'Raúl', 'Hugo', 'Salvador',
  'Rubén', 'Pedro', 'Antonio', 'Víctor Hugo', 'Ángel', 'Gustavo', 'Omar',
  'Alberto', 'Mauricio', 'Cristian', 'Joel', 'Armando', 'Ernesto',
];

const APELLIDOS = [
  'García', 'Hernández', 'Martínez', 'López', 'González', 'Rodríguez',
  'Pérez', 'Sánchez', 'Ramírez', 'Flores', 'Gómez', 'Díaz', 'Reyes',
  'Torres', 'Morales', 'Vázquez', 'Jiménez', 'Ruiz', 'Ortiz', 'Chávez',
  'Ramos', 'Gutiérrez', 'Mendoza', 'Herrera', 'Medina', 'Castro', 'Vargas',
  'Rojas', 'Guerrero', 'Aguilar', 'Estrada', 'Salcido', 'Nájera', 'Rivas',
  'Ontiveros', 'Bátiz', 'Nevárez', 'Soto', 'Covarrubias', 'Delgado',
  'Cervantes', 'Ibarra', 'Muñoz', 'Cárdenas', 'Contreras', 'Domínguez',
  'Espinoza', 'Fuentes', 'Juárez', 'Luna', 'Molina', 'Navarro', 'Ochoa',
  'Peña', 'Quintero', 'Salazar', 'Solís', 'Terrazas', 'Urbina',
  'Valenzuela', 'Zamora',
];

function generarNombreCompleto(genero_id: number): string {
  const pool = genero_id === ID_GENERO_FEMENINO ? NOMBRES_F : NOMBRES_M;
  const nombre = rng.pick(pool);
  const apellido1 = rng.pick(APELLIDOS);
  let apellido2 = rng.pick(APELLIDOS);
  while (apellido2 === apellido1) apellido2 = rng.pick(APELLIDOS);
  return `${nombre} ${apellido1} ${apellido2}`;
}

// ── Ubicación ──────────────────────────────────────────────────────────
// Formato OBLIGATORIO "Ciudad, Estado, País" — los reportes geográficos
// separan el país con SUBSTRING_INDEX(..., ',', -1).
const CIUDADES_DURANGO = [
  'Durango, Durango, México',
  'Gómez Palacio, Durango, México',
  'Lerdo, Durango, México',
  'Vicente Guerrero, Durango, México',
  'Canatlán, Durango, México',
  'Santiago Papasquiaro, Durango, México',
  'El Salto, Durango, México',
  'Nombre de Dios, Durango, México',
];

const CIUDADES_MEXICO_OTRAS = [
  'Torreón, Coahuila, México',
  'Saltillo, Coahuila, México',
  'Monclova, Coahuila, México',
  'Monterrey, Nuevo León, México',
  'Chihuahua, Chihuahua, México',
  'Ciudad Juárez, Chihuahua, México',
  'Culiacán, Sinaloa, México',
  'Mazatlán, Sinaloa, México',
  'Zacatecas, Zacatecas, México',
  'Guadalajara, Jalisco, México',
  'Ciudad de México, Ciudad de México, México',
  'Aguascalientes, Aguascalientes, México',
  'Hermosillo, Sonora, México',
  'Querétaro, Querétaro, México',
  'Tijuana, Baja California, México',
  'León, Guanajuato, México',
  'Puebla, Puebla, México',
  'Mérida, Yucatán, México',
  'San Luis Potosí, San Luis Potosí, México',
  'Toluca, Estado de México, México',
];

const CIUDADES_EXTRANJERO = [
  'Houston, Texas, Estados Unidos de América',
  'Dallas, Texas, Estados Unidos de América',
  'Denver, Colorado, Estados Unidos de América',
  'Los Ángeles, California, Estados Unidos de América',
  'Chicago, Illinois, Estados Unidos de América',
  'Toronto, Ontario, Canadá',
  'Madrid, Madrid, España',
  'Berlín, Berlín, Alemania',
];

// Lista única de países válidos como último segmento — usada TANTO para
// generar los datos COMO para la consulta de verificación, así ambas
// quedan garantizadas consistentes entre sí.
const PAISES_VALIDOS = ['México', 'Estados Unidos de América', 'Canadá', 'España', 'Alemania'];

const PAISES_NACIMIENTO_EXTRANJERO = ['Estados Unidos', 'Canadá', 'España', 'Guatemala', 'Colombia'];

function pickCiudadResidencia(): string {
  const r = rng.float();
  if (r < 0.7) return rng.pick(CIUDADES_DURANGO);
  if (r < 0.95) return rng.pick(CIUDADES_MEXICO_OTRAS);
  return rng.pick(CIUDADES_EXTRANJERO);
}

function pickCiudadTrabajo(): string {
  const r = rng.float();
  if (r < 0.65) return rng.pick(CIUDADES_DURANGO);
  if (r < 0.92) return rng.pick(CIUDADES_MEXICO_OTRAS);
  return rng.pick(CIUDADES_EXTRANJERO);
}

function pickPaisNacimiento(): string {
  return rng.bool(0.97) ? 'México' : rng.pick(PAISES_NACIMIENTO_EXTRANJERO);
}

function generarTelefono(): string {
  if (rng.bool(0.75)) {
    return '618' + String(rng.int(1000000, 9999999));
  }
  const otrosLada = ['33', '81', '656', '871', '844', '999', '664', '662'];
  const lada = rng.pick(otrosLada);
  const restantes = 10 - lada.length;
  const min = Math.pow(10, restantes - 1);
  const max = Math.pow(10, restantes) - 1;
  return lada + String(rng.int(min, max));
}

// ── Correo ─────────────────────────────────────────────────────────────
const DOMINIOS_CORREO: [string, number][] = [
  ['gmail.com', 50], ['hotmail.com', 25], ['outlook.com', 15], ['yahoo.com', 10],
];

const correosUsados = new Set<string>();

function generarCorreoUnico(nombreCompleto: string): string {
  const partes = quitarAcentos(nombreCompleto).toLowerCase().split(/\s+/);
  const primero = partes[0];
  const ultimo = partes[partes.length - 1];
  for (let intento = 0; intento < 50; intento++) {
    const dominio = rng.pickWeighted(DOMINIOS_CORREO);
    const patron = rng.int(0, 3);
    const sufijo = rng.int(1, 999);
    let local: string;
    switch (patron) {
      case 0: local = `${primero}.${ultimo}${sufijo}`; break;
      case 1: local = `${primero}${ultimo}${sufijo}`; break;
      case 2: local = `${primero[0]}${ultimo}${sufijo}`; break;
      default: local = `${primero}.${ultimo}`; break;
    }
    const correo = `${local}@${dominio}`;
    if (!correosUsados.has(correo)) {
      correosUsados.add(correo);
      return correo;
    }
  }
  throw new Error('No se pudo generar un correo único tras 50 intentos.');
}

// ── Carreras: reparto ponderado ───────────────────────────────────────
// Todos los mapas de abajo se indexan por el TEXTO exacto del catálogo
// `carreras` (nombre_carrera), nunca por id — el id real se resuelve en
// tiempo de ejecución en prepararTablasDinamicas().
const PESO_CARRERA_POR_NOMBRE: Record<string, number> = {
  'Arquitectura': 40,
  'Ingeniería Civil': 45,
  'Ingeniería Eléctrica': 20,
  'Ingeniería Electrónica': 20,
  'Ingeniería Industrial (Presencial / A distancia)': 55,
  'Ingeniería Industrial en Eléctrica': 10,
  'Ingeniería Industrial en Electrónica': 10,
  'Ingeniería Industrial en Mecánica': 10,
  'Ingeniería Industrial en Producción': 10,
  'Ingeniería Mecánica': 25,
  'Ingeniería Mecatrónica': 25,
  'Ingeniería Química': 15,
  'Ingeniería Bioquímica': 15,
  'Ingeniería en Sistemas Computacionales (Presencial / Virtual)': 60,
  'Ingeniería en Gestión Empresarial': 40,
  "Ingeniería Tecnologías de la Información y Comunicaciones (TIC's)": 20,
  'Ingeniería Informática': 20,
  'Licenciatura en Administración (Presencial / A distancia)': 30,
  'Ingeniería Biomédica': 10,
  'Ingeniería en Semiconductores': 8,
  'Ingeniería en Inteligencia Artificial': 12,
  'Ingeniería Logística': 10,
  'Maestría': 3,
  'Posgrado': 2,
};
const PESO_CARRERA_DEFAULT = 5;

// ── Género por carrera (proporción variable) ──────────────────────────
const PROB_FEMENINO_POR_NOMBRE: Record<string, number> = {
  'Ingeniería Bioquímica': 0.65,
  'Ingeniería Química': 0.55,
  'Licenciatura en Administración (Presencial / A distancia)': 0.60,
  'Ingeniería en Gestión Empresarial': 0.45,
  'Ingeniería Biomédica': 0.55,
  'Ingeniería Mecánica': 0.12,
  'Ingeniería Eléctrica': 0.12,
  'Ingeniería Electrónica': 0.15,
  'Ingeniería Industrial en Eléctrica': 0.15,
  'Ingeniería Industrial en Electrónica': 0.18,
  'Ingeniería Industrial en Mecánica': 0.15,
  'Ingeniería Mecatrónica': 0.18,
};
const PROB_FEMENINO_DEFAULT = 0.32;

// ── Puestos por carrera (agrupados por afinidad) ──────────────────────
const GRUPO_SOFTWARE = [
  'Ingeniería en Sistemas Computacionales (Presencial / Virtual)',
  "Ingeniería Tecnologías de la Información y Comunicaciones (TIC's)",
  'Ingeniería Informática', 'Ingeniería en Inteligencia Artificial',
];
const GRUPO_INDUSTRIAL = [
  'Ingeniería Industrial (Presencial / A distancia)', 'Ingeniería Industrial en Eléctrica',
  'Ingeniería Industrial en Electrónica', 'Ingeniería Industrial en Mecánica',
  'Ingeniería Industrial en Producción', 'Ingeniería Logística',
];
const GRUPO_CIVIL = ['Ingeniería Civil'];
const GRUPO_ARQ = ['Arquitectura'];
const GRUPO_ELECTRO = [
  'Ingeniería Eléctrica', 'Ingeniería Electrónica', 'Ingeniería Mecatrónica',
  'Ingeniería Biomédica', 'Ingeniería en Semiconductores',
];
const GRUPO_MECANICA = ['Ingeniería Mecánica'];
const GRUPO_QUIMICA = ['Ingeniería Química', 'Ingeniería Bioquímica'];
const GRUPO_ADMIN = ['Ingeniería en Gestión Empresarial', 'Licenciatura en Administración (Presencial / A distancia)'];
const GRUPO_POSGRADO = ['Maestría', 'Posgrado'];

// Tablas resueltas a id, preparadas una sola vez por prepararTablasDinamicas().
let PESO_CARRERA_POR_ID = new Map<number, number>();
let PROB_FEMENINO_POR_ID = new Map<number, number>();
let GRUPO_POR_CARRERA_ID = new Map<number, string>();
let ID_GENERO_FEMENINO = 0;
let ID_GENERO_MASCULINO = 0;

function nombreGrupo(nombreCarrera: string): string {
  if (GRUPO_SOFTWARE.includes(nombreCarrera)) return 'software';
  if (GRUPO_INDUSTRIAL.includes(nombreCarrera)) return 'industrial';
  if (GRUPO_CIVIL.includes(nombreCarrera)) return 'civil';
  if (GRUPO_ARQ.includes(nombreCarrera)) return 'arquitectura';
  if (GRUPO_ELECTRO.includes(nombreCarrera)) return 'electro';
  if (GRUPO_MECANICA.includes(nombreCarrera)) return 'mecanica';
  if (GRUPO_QUIMICA.includes(nombreCarrera)) return 'quimica';
  if (GRUPO_ADMIN.includes(nombreCarrera)) return 'admin';
  if (GRUPO_POSGRADO.includes(nombreCarrera)) return 'posgrado';
  return 'general';
}

// Resuelve TODOS los ids reales desde los catálogos cargados de la base.
// Se llama una sola vez en main(), antes de generar cualquier registro.
function prepararTablasDinamicas(catalogos: Catalogos): void {
  for (const c of catalogos.carreras) {
    PESO_CARRERA_POR_ID.set(c.id, PESO_CARRERA_POR_NOMBRE[c.texto] ?? PESO_CARRERA_DEFAULT);
    PROB_FEMENINO_POR_ID.set(c.id, PROB_FEMENINO_POR_NOMBRE[c.texto] ?? PROB_FEMENINO_DEFAULT);
    GRUPO_POR_CARRERA_ID.set(c.id, nombreGrupo(c.texto));
  }
  const idF = catalogos.generos.get('Femenino');
  const idM = catalogos.generos.get('Masculino');
  if (idF === undefined || idM === undefined) {
    throw new Error('El catálogo generos no tiene "Femenino"/"Masculino".');
  }
  ID_GENERO_FEMENINO = idF;
  ID_GENERO_MASCULINO = idM;
}

function pickCarreraId(): number {
  const pares = [...PESO_CARRERA_POR_ID.entries()];
  return rng.pickWeighted(pares);
}

function pickGeneroId(carrera_id: number): number {
  const p = PROB_FEMENINO_POR_ID.get(carrera_id) ?? PROB_FEMENINO_DEFAULT;
  return rng.bool(p) ? ID_GENERO_FEMENINO : ID_GENERO_MASCULINO;
}

const PUESTOS_POR_GRUPO: Record<string, string[]> = {
  software: [
    'Desarrollador de Software', 'Ingeniero de Software', 'Analista de Sistemas',
    'Administrador de Bases de Datos', 'Desarrollador Full Stack',
    'Ingeniero DevOps', 'Analista de Datos', 'Consultor de Tecnologías de la Información',
    'Líder Técnico de Desarrollo', 'Especialista en Ciberseguridad',
  ],
  industrial: [
    'Ingeniero de Procesos', 'Ingeniero de Calidad', 'Supervisor de Producción',
    'Jefe de Planta', 'Analista de Mejora Continua', 'Coordinador de Logística',
    'Ingeniero Industrial', 'Jefe de Manufactura',
  ],
  civil: [
    'Residente de Obra', 'Ingeniero Proyectista', 'Supervisor de Construcción',
    'Gerente de Proyecto', 'Ingeniero de Costos',
  ],
  arquitectura: [
    'Arquitecto de Proyecto', 'Diseñador Arquitectónico', 'Supervisor de Obra',
    'Gerente de Diseño',
  ],
  electro: [
    'Ingeniero Eléctrico', 'Ingeniero Electrónico', 'Ingeniero de Mantenimiento',
    'Ingeniero de Automatización', 'Ingeniero de Pruebas', 'Técnico Especialista',
  ],
  mecanica: [
    'Ingeniero de Diseño Mecánico', 'Ingeniero de Mantenimiento',
    'Supervisor de Manufactura', 'Ingeniero de Manufactura',
  ],
  quimica: [
    'Ingeniero de Procesos Químicos', 'Químico de Control de Calidad',
    'Ingeniero de Formulación', 'Supervisor de Planta',
  ],
  admin: [
    'Analista Administrativo', 'Coordinador de Recursos Humanos',
    'Gerente de Operaciones', 'Analista Financiero', 'Ejecutivo de Ventas',
    'Coordinador Administrativo',
  ],
  posgrado: [
    'Docente e Investigador', 'Coordinador Académico', 'Consultor Especializado',
    'Investigador',
  ],
  general: [
    'Coordinador de Proyectos', 'Analista Técnico', 'Supervisor de Área',
  ],
};

function pickPuesto(carrera_id: number): string {
  const grupo = GRUPO_POR_CARRERA_ID.get(carrera_id) ?? 'general';
  return rng.pick(PUESTOS_POR_GRUPO[grupo] ?? PUESTOS_POR_GRUPO.general);
}

const EMPRESAS = [
  'Peñoles', 'Grupo México', 'Nissan Mexicana', 'Lala', 'Arca Continental',
  'Fábrica de Jabón La Corona', 'Grupo Bimbo', 'CEMEX', 'FEMSA', 'Softtek',
  'IBM México', 'Oracle México', 'Accenture', 'Praxair', 'Derek',
  'Gobierno del Estado de Durango', 'Municipio de Durango',
  'Universidad Juárez del Estado de Durango', 'Secretaría de Educación Pública',
  'Comisión Federal de Electricidad', 'Grupo Salinas', 'Cummins', 'Flex',
  'Lear Corporation', 'Delphi', 'John Deere', 'Grupo Vasconia',
  'Impulsora Durango', 'Alpek', 'HEB México', 'Banco Banorte',
];

const PLANTILLAS_EMPRESA_PROPIA = [
  (ap: string) => `${ap} Consultores`,
  (ap: string) => `Estudio ${ap}`,
  (ap: string) => `${ap} Soluciones Tecnológicas`,
  (ap: string) => `Grupo ${ap}`,
  (ap: string) => `${ap} Ingeniería y Construcción`,
  (ap: string) => `${ap} & Asociados`,
];

function generarEmpresaPropia(apellido: string): string {
  return rng.pick(PLANTILLAS_EMPRESA_PROPIA)(apellido);
}

const PUESTOS_PRIMER_EMPLEO = [
  'Practicante', 'Becario', 'Analista Junior', 'Ingeniero Junior',
  'Auxiliar Técnico', 'Asistente de Proyecto',
];

// ── Instituciones / estudios posteriores ──────────────────────────────
const INSTITUCIONES = [
  'Instituto Tecnológico de Durango', 'Universidad Juárez del Estado de Durango',
  'Tecnológico de Monterrey', 'UNAM', 'Instituto Politécnico Nacional',
  'Universidad Autónoma de Durango', 'Universidad La Salle',
  'Universidad Panamericana', 'Tecnológico Nacional de México',
  'Universidad de Guadalajara',
];

const PROGRAMAS_POR_NIVEL: Record<string, string[]> = {
  especialidad: ['Especialidad en Gestión de Proyectos', 'Especialidad en Calidad'],
  maestria: [
    'Maestría en Administración de Negocios', 'Maestría en Ciencias de la Ingeniería',
    'Maestría en Tecnologías de la Información', 'Maestría en Gestión de la Calidad',
  ],
  doctorado: ['Doctorado en Ciencias de la Ingeniería', 'Doctorado en Administración'],
  diplomado: ['Diplomado en Gestión de Proyectos', 'Diplomado en Desarrollo de Software'],
};

// ── Certificaciones profesionales (nunca maestrías/posgrados) ────────
const CERTIFICACIONES_PROFESIONALES = [
  'AWS Certified Solutions Architect', 'Scrum Master (CSM)',
  'Six Sigma Green Belt', 'CCNA', 'Autodesk Certified Professional (AutoCAD)',
  'PMP', 'Microsoft Certified: Azure Fundamentals', 'ITIL Foundation',
  'CompTIA A+', 'SAP Certified Application Associate', 'Lean Manufacturing',
  'Certificación en Normas ISO 9001', 'Google Cloud Associate Engineer',
];

// ── Emprendimientos / proyectos sociales ──────────────────────────────
const GIROS_EMPRENDIMIENTO = [
  'Desarrollo de software', 'Construcción y remodelación', 'Consultoría empresarial',
  'Diseño arquitectónico', 'Comercio electrónico', 'Manufactura', 'Servicios de ingeniería',
];

const PROYECTOS_SOCIALES_NOMBRES = [
  'Brigada de reforestación Sierra de Durango', 'Programa de tutorías comunitarias ITD',
  'Voluntariado Cruz Roja Durango', 'Campaña de alfabetización digital',
  'Proyecto de agua potable en comunidad rural', 'Jornada de salud comunitaria',
  'Programa de mentoría para estudiantes de nuevo ingreso',
];

const ORGANIZACIONES_SOCIALES = [
  'Cruz Roja Mexicana', 'DIF Durango', 'Fundación ITD', 'Rotary Club Durango', null,
];

// ── Lenguas indígenas (Durango y México) ──────────────────────────────
const LENGUAS_INDIGENAS = [
  'Tepehuano', 'Náhuatl', 'Huichol (Wixárika)', 'Mixteco', 'Zapoteco',
  'Rarámuri', 'Totonaco', 'Maya', 'Otomí',
];

// ── Textos libres "otro" ───────────────────────────────────────────────
const HABILIDAD_OTRO_TEXTOS = [
  'Gestión de proyectos', 'Manejo de equipos multidisciplinarios',
  'Comunicación efectiva en inglés técnico', 'Negociación con proveedores',
  'Análisis financiero', 'Redacción técnica',
];

const COLABORACION_OTRO_TEXTOS = [
  'Podría colaborar impartiendo cursos de certificación',
  'Disponible para mentorías virtuales',
  'Puedo apoyar en la revisión de proyectos de titulación',
  'Interesado en dar seguimiento a egresados de mi generación',
];

const MEDIO_OTRO_TEXTOS = [
  'Contacto directo con la empresa', 'Servicio social', 'Feria de empleo',
  'Recomendación de un profesor',
];

// ═══════════════════════════════════════════════════════════════════════
// Catálogos (se cargan de la base — NUNCA se escriben ids a mano)
// ═══════════════════════════════════════════════════════════════════════
interface Catalogos {
  carreras: { id: number; texto: string }[];
  generos: Map<string, number>;
  situacionLaboral: { id: number; texto: string }[];
  coincidenciaLaboral: Map<string, number>;
  tiempoPrimerEmpleo: { id: number; texto: string }[];
  medioPrimerEmpleo: { id: number; texto: string }[];
  antiguedadEmpleo: { id: number; texto: string }[];
  nivelesIngles: { id: number; texto: string }[];
  habilidades: { id: number; texto: string }[];
  colaboraciones: { id: number; texto: string }[];
  discapacidadDominios: { id: number; clave: string }[];
  gradosDificultad: Map<string, number>;
  respuestasAutoadscripcion: Map<string, number>;
  nivelesEstudio: Map<string, number>;
  estadosEstudio: Map<string, number>;
  tiposProyectoSocial: { id: number; clave: string }[];
  rangosEmpleados: { id: number; clave: string }[];
  admins: string[]; // usuarios (login) con rol admin y estado activo
}

async function cargarCatalogos(conn: mysql.Connection): Promise<Catalogos> {
  const q = async (sql: string) => (await conn.query(sql))[0] as any[];

  const carrerasRows = await q('SELECT id_carrera, nombre_carrera FROM carreras ORDER BY id_carrera');
  const generosRows = await q('SELECT id_genero, genero FROM generos ORDER BY id_genero');
  const situacionRows = await q('SELECT id_situacion, situacion FROM situacion_laboral ORDER BY id_situacion');
  const coincidenciaRows = await q('SELECT id_coincidencia, nivel FROM coincidencia_laboral ORDER BY id_coincidencia');
  const tiempoRows = await q('SELECT id_tiempo, rango FROM tiempo_primer_empleo ORDER BY orden');
  const medioRows = await q('SELECT id_medio, medio FROM medio_primer_empleo ORDER BY orden');
  const antiguedadRows = await q('SELECT id_antiguedad, rango FROM antiguedad_empleo ORDER BY id_antiguedad');
  const nivelesInglesRows = await q('SELECT id_nivel, nivel FROM niveles_ingles ORDER BY id_nivel');
  const habilidadesRows = await q('SELECT id_habilidad, habilidad FROM habilidades ORDER BY id_habilidad');
  const colaboracionesRows = await q('SELECT id_colaboracion, descripcion FROM colaboraciones ORDER BY id_colaboracion');
  const discapacidadRows = await q('SELECT id_dominio, clave FROM discapacidad_dominios ORDER BY orden');
  const gradosRows = await q('SELECT id_grado, clave FROM grados_dificultad ORDER BY orden');
  const respuestasRows = await q('SELECT id_respuesta, clave FROM respuestas_autoadscripcion ORDER BY orden');
  const nivelesEstudioRows = await q('SELECT id_nivel_estudio, clave FROM niveles_estudio ORDER BY orden');
  const estadosEstudioRows = await q('SELECT id_estado_estudio, clave FROM estados_estudio ORDER BY orden');
  const tiposProyectoRows = await q('SELECT id_tipo_proyecto, clave FROM tipos_proyecto_social ORDER BY orden');
  const rangosRows = await q('SELECT id_rango_empleados, clave FROM rangos_empleados ORDER BY orden');
  const adminRows = await q(`SELECT usuario FROM usuarios WHERE rol = 'admin' AND estado = 'activo' ORDER BY id_usuario`);

  if (adminRows.length === 0) {
    throw new Error('No hay usuarios admin activos en la base; no se puede asignar revisado_por.');
  }

  return {
    carreras: carrerasRows.map((r) => ({ id: r.id_carrera, texto: r.nombre_carrera })),
    generos: new Map(generosRows.map((r) => [r.genero, r.id_genero])),
    situacionLaboral: situacionRows.map((r) => ({ id: r.id_situacion, texto: r.situacion })),
    coincidenciaLaboral: new Map(coincidenciaRows.map((r) => [r.nivel, r.id_coincidencia])),
    tiempoPrimerEmpleo: tiempoRows.map((r) => ({ id: r.id_tiempo, texto: r.rango })),
    medioPrimerEmpleo: medioRows.map((r) => ({ id: r.id_medio, texto: r.medio })),
    antiguedadEmpleo: antiguedadRows.map((r) => ({ id: r.id_antiguedad, texto: r.rango })),
    nivelesIngles: nivelesInglesRows.map((r) => ({ id: r.id_nivel, texto: r.nivel })),
    habilidades: habilidadesRows.map((r) => ({ id: r.id_habilidad, texto: r.habilidad })),
    colaboraciones: colaboracionesRows.map((r) => ({ id: r.id_colaboracion, texto: r.descripcion })),
    discapacidadDominios: discapacidadRows.map((r) => ({ id: r.id_dominio, clave: r.clave })),
    gradosDificultad: new Map(gradosRows.map((r) => [r.clave, r.id_grado])),
    respuestasAutoadscripcion: new Map(respuestasRows.map((r) => [r.clave, r.id_respuesta])),
    nivelesEstudio: new Map(nivelesEstudioRows.map((r) => [r.clave, r.id_nivel_estudio])),
    estadosEstudio: new Map(estadosEstudioRows.map((r) => [r.clave, r.id_estado_estudio])),
    tiposProyectoSocial: tiposProyectoRows.map((r) => ({ id: r.id_tipo_proyecto, clave: r.clave })),
    rangosEmpleados: rangosRows.map((r) => ({ id: r.id_rango_empleados, clave: r.clave })),
    admins: adminRows.map((r) => r.usuario),
  };
}

// ═══════════════════════════════════════════════════════════════════════
// Modelo del registro generado
// ═══════════════════════════════════════════════════════════════════════
interface EstudioGen { id_nivel_estudio: number; nombre_programa: string; institucion: string; id_estado_estudio: number; anio: number; }
interface EmprendimientoGen { nombre: string; giro: string; anio_inicio: number; sigue_operando: 0 | 1; id_rango_empleados: number; }
interface ProyectoSocialGen { nombre: string; id_tipo_proyecto: number; anio: number; organizacion: string | null; }
interface DiscapacidadGen { id_dominio: number; id_grado: number; }
interface IdentidadGen { id_indigena: number; id_habla_lengua: number; lengua_indigena: string | null; id_afromexicano: number; }

interface EgresadoGen {
  nombre_completo: string;
  genero_id: number;
  correo: string;
  telefono: string;
  ciudad_residencia: string;
  pais_nacimiento: string;
  carrera_id: number;
  anio_ingreso: number;
  periodo_ingreso: string;
  anio_egreso: number;
  estatus_titulacion: string;
  nivel_ingles_id: number;
  situacion_laboral_id: number;
  empresa: string | null;
  antiguedad_empleo_id: number | null;
  tiempo_primer_empleo_id: number;
  medio_primer_empleo_id: number | null;
  medio_primer_empleo_otro: string;
  primer_empleo_empresa: string | null;
  primer_empleo_puesto: string | null;
  ciudad_trabajo: string | null;
  satisfaccion_formacion: number;
  numero_control: string;
  linkedin: string | null;
  facebook: string | null;
  instagram: string | null;
  puesto_trabajo: string | null;
  coincidencia_laboral_id: number;
  foto_url: null;
  registro_completo: 0 | 1;
  fecha_registro: Date;
  revisado: 0 | 1;
  fecha_revision: Date | null;
  revisado_por: string | null;
  consintio_datos_sensibles: 0 | 1;
  fecha_consentimiento_sensibles: Date | null;

  habilidades: number[];
  habilidad_otro: string | null;
  colaboraciones: number[];
  colaboracion_otro: string | null;
  certificaciones: string[];
  discapacidad: DiscapacidadGen[];
  identidad: IdentidadGen | null;
  estudios: EstudioGen[];
  emprendimientos: EmprendimientoGen[];
  proyectos_sociales: ProyectoSocialGen[];
}

const numerosControlUsados = new Set<string>();

function generarNumeroControl(anio_ingreso: number): string {
  const r = rng.float();
  if (r < 0.05) return 'Desconocido';
  const prefijoCambio = r < 0.10 ? 'c' : '';
  const anio2 = String(anio_ingreso).slice(-2);
  for (let intento = 0; intento < 50; intento++) {
    const nc = `${prefijoCambio}${anio2}04${String(rng.int(0, 9999)).padStart(4, '0')}`;
    if (!numerosControlUsados.has(nc)) {
      numerosControlUsados.add(nc);
      return nc;
    }
  }
  throw new Error('No se pudo generar un numero_control único.');
}

function generarLinkedin(nombreCompleto: string): string {
  const partes = quitarAcentos(nombreCompleto).toLowerCase().split(/\s+/);
  const slug = `${partes[0]}-${partes[partes.length - 1]}-${rng.int(10, 999)}`;
  return `https://www.linkedin.com/in/${slug}`;
}

function generarRedSocial(nombreCompleto: string, red: 'facebook' | 'instagram'): string {
  const partes = quitarAcentos(nombreCompleto).toLowerCase().split(/\s+/);
  const slug = `${partes[0]}.${partes[partes.length - 1]}${rng.int(1, 99)}`;
  return red === 'facebook' ? `https://facebook.com/${slug}` : `https://instagram.com/${slug}`;
}

function pickAnioEgreso(): number {
  const pares: [number, number][] = [];
  for (let y = 2008; y <= ANIO_ACTUAL; y++) pares.push([y, y - 2007]);
  return rng.pickWeighted(pares);
}

function pickDiffIngreso(): number {
  const r = rng.float();
  if (r < 0.70) return rng.int(4, 6);
  if (r < 0.95) return rng.int(7, 10);
  return rng.int(11, 15);
}

function pickEstatusTitulacion(anio_egreso: number): string {
  if (anio_egreso >= 2025) {
    return rng.pickWeighted<string>([
      ['Titulado', 15], ['En trámite', 60], ['No titulado', 25],
    ]);
  }
  const yearsSince = ANIO_ACTUAL - anio_egreso;
  const pTitulado = Math.min(0.92, 0.35 + 0.05 * yearsSince);
  const pNoTitulado = Math.max(0.03, 0.18 - 0.01 * yearsSince);
  const pTramite = Math.max(0.02, 1 - pTitulado - pNoTitulado);
  return rng.pickWeighted<string>([
    ['Titulado', pTitulado], ['En trámite', pTramite], ['No titulado', pNoTitulado],
  ]);
}

// Genera un registro completo, aleatorio, respetando todas las reglas de
// negocio. `forzar` permite fijar campos específicos (usado por las parejas
// de duplicados sembrados) sin romper la coherencia del resto del registro.
function generarRegistro(
  catalogos: Catalogos,
  forzar: Partial<Pick<EgresadoGen,
    'nombre_completo' | 'genero_id' | 'carrera_id' | 'anio_egreso' | 'anio_ingreso' |
    'telefono' | 'numero_control' | 'registro_completo'
  >> = {},
): EgresadoGen {
  const carrera_id = forzar.carrera_id ?? pickCarreraId();
  const genero_id = forzar.genero_id ?? pickGeneroId(carrera_id);
  const nombre_completo = forzar.nombre_completo ?? generarNombreCompleto(genero_id);
  const apellidoPrincipal = nombre_completo.trim().split(/\s+/).slice(-2)[0];

  const anio_egreso = forzar.anio_egreso ?? pickAnioEgreso();
  const anio_ingreso = forzar.anio_ingreso ?? (anio_egreso - pickDiffIngreso());

  const periodo_ingreso = rng.pickWeighted<string>([
    ['Enero - Junio', 45], ['Agosto - Diciembre', 45], ['No lo recuerdo', 10],
  ]);

  const pais_nacimiento = pickPaisNacimiento();
  const ciudad_residencia = pickCiudadResidencia();
  const telefono = forzar.telefono ?? generarTelefono();
  const correo = generarCorreoUnico(nombre_completo);

  const facebook = rng.bool(0.20) ? generarRedSocial(nombre_completo, 'facebook') : null;
  const instagram = rng.bool(0.20) ? generarRedSocial(nombre_completo, 'instagram') : null;

  const situacion = rng.pickWeighted(catalogos.situacionLaboral.map((s) => {
    const pesos: Record<string, number> = {
      'Empleado en el sector privado': 45,
      'Empleado en el sector público': 20,
      'Empresario / Trabajo por cuenta propia (Freelance)': 15,
      'Desempleado': 8,
      'Estudiando Posgrado': 7,
      'Dedicado al hogar u otras actividades': 5,
    };
    return [s, pesos[s.texto] ?? 5] as [typeof s, number];
  }));

  const situacionesInactivas = ['Desempleado', 'Estudiando Posgrado', 'Dedicado al hogar u otras actividades'];
  const activo = !situacionesInactivas.includes(situacion.texto);

  let empresa: string | null = null;
  let ciudad_trabajo: string | null = null;
  let puesto_trabajo: string | null = null;
  let antiguedad_empleo_id: number | null = null;

  if (activo) {
    if (situacion.texto.startsWith('Empresario')) {
      empresa = generarEmpresaPropia(apellidoPrincipal);
    } else {
      empresa = rng.pick(EMPRESAS);
    }
    puesto_trabajo = pickPuesto(carrera_id);
    ciudad_trabajo = pickCiudadTrabajo();
    const ant = rng.pick(catalogos.antiguedadEmpleo);
    antiguedad_empleo_id = ant.id;
  }

  const estatus_titulacion = pickEstatusTitulacion(anio_egreso);

  const nivel_ingles = rng.pickWeighted(catalogos.nivelesIngles.map((n) => {
    const w = n.texto.startsWith('Básico') ? 30 : n.texto.startsWith('Intermedio') ? 45 : 25;
    return [n, w] as [typeof n, number];
  }));

  const satisfaccion_formacion = rng.pickWeighted<number>([
    [1, 5], [2, 10], [3, 20], [4, 40], [5, 25],
  ]);

  let autorizo_estadisticas = rng.bool(0.90);
  let autorizo_contacto = rng.bool(0.40);
  let autorizo_eventos = rng.bool(0.35);
  if (!autorizo_estadisticas && !autorizo_contacto && !autorizo_eventos) {
    autorizo_estadisticas = true;
  }

  // ── Primer empleo ───────────────────────────────────────────────────
  const tiempoElegido = rng.bool(0.08)
    ? catalogos.tiempoPrimerEmpleo.find((t) => t.texto === 'Aún no he conseguido empleo')!
    : rng.pickWeighted(catalogos.tiempoPrimerEmpleo
        .filter((t) => t.texto !== 'Aún no he conseguido empleo')
        .map((t, i) => [t, [25, 25, 20, 20, 10][i] ?? 10] as [typeof t, number]));

  const sinEmpleo = tiempoElegido.texto === 'Aún no he conseguido empleo';

  let medio_primer_empleo_id: number | null = null;
  let medio_primer_empleo_otro = '';
  let primer_empleo_empresa: string | null = null;
  let primer_empleo_puesto: string | null = null;

  if (!sinEmpleo) {
    const opcionesMedio = catalogos.medioPrimerEmpleo;
    const medioElegido = rng.pickWeighted(opcionesMedio.map((m) => {
      const w = m.texto === 'Otra' ? 10 : 22.5;
      return [m, w] as [typeof m, number];
    }));
    medio_primer_empleo_id = medioElegido.id;
    if (medioElegido.texto === 'Otra') {
      medio_primer_empleo_otro = rng.pick(MEDIO_OTRO_TEXTOS);
    }
    primer_empleo_empresa = rng.pick(EMPRESAS);
    primer_empleo_puesto = rng.pick(PUESTOS_PRIMER_EMPLEO);
  }

  // ── Etapa 2 / completitud ────────────────────────────────────────────
  const registro_completo: 0 | 1 = forzar.registro_completo ?? (rng.bool(0.94) ? 1 : 0);

  let numero_control: string;
  let linkedin: string | null = null;
  let coincidencia_laboral_id: number;
  let habilidades: number[] = [];
  let habilidad_otro: string | null = null;
  let colaboraciones: number[] = [];
  let colaboracion_otro: string | null = null;
  let certificaciones: string[] = [];

  if (registro_completo === 1) {
    numero_control = forzar.numero_control ?? generarNumeroControl(anio_ingreso);
    linkedin = rng.bool(0.60) ? generarLinkedin(nombre_completo) : null;

    coincidencia_laboral_id = activo
      ? rng.pickWeighted<number>([
          [catalogos.coincidenciaLaboral.get('Totalmente')!, 25],
          [catalogos.coincidenciaLaboral.get('En gran medida')!, 30],
          [catalogos.coincidenciaLaboral.get('Parcialmente')!, 25],
          [catalogos.coincidenciaLaboral.get('Poco')!, 12],
          [catalogos.coincidenciaLaboral.get('Nada')!, 8],
        ])
      : catalogos.coincidenciaLaboral.get('No aplica / Actualmente no estoy laborando')!;

    const nHab = rng.int(1, 4);
    habilidades = rng.sample(catalogos.habilidades, nHab).map((h) => h.id);
    if (rng.bool(0.30)) habilidad_otro = rng.pick(HABILIDAD_OTRO_TEXTOS);

    const noPuedoParticipar = catalogos.colaboraciones.find(
      (c) => c.texto === 'Por el momento no me es posible participar',
    )!;
    if (rng.bool(0.10)) {
      colaboraciones = [noPuedoParticipar.id];
    } else {
      const resto = catalogos.colaboraciones.filter((c) => c.id !== noPuedoParticipar.id);
      const nColab = rng.int(1, 3);
      colaboraciones = rng.sample(resto, nColab).map((c) => c.id);
    }
    if (rng.bool(0.30)) colaboracion_otro = rng.pick(COLABORACION_OTRO_TEXTOS);

    if (rng.bool(0.40)) {
      const n = rng.bool(0.7) ? 1 : 2;
      certificaciones = rng.sample(CERTIFICACIONES_PROFESIONALES, n);
    }
  } else {
    // Exactamente como los deja crearEtapa1: sin numero_control real, sin
    // linkedin y SIN filas de habilidades/colaboraciones/certificaciones.
    numero_control = '';
    linkedin = null;
    coincidencia_laboral_id = catalogos.coincidenciaLaboral.get('Totalmente')!; // valor hardcode del INSERT de etapa1
  }

  // ── Registro / revisión ─────────────────────────────────────────────
  const fecha_registro = fechaAleatoriaEntre(sumarDias(HOY, -365), HOY);
  const revisado: 0 | 1 = rng.bool(0.60) ? 1 : 0;
  let revisado_por: string | null = null;
  let fecha_revision: Date | null = null;
  if (revisado === 1) {
    revisado_por = rng.pick(catalogos.admins);
    const maxDias = Math.max(1, Math.floor((HOY.getTime() - fecha_registro.getTime()) / 86400000));
    fecha_revision = sumarDias(fecha_registro, rng.int(1, Math.min(90, maxDias)));
  }

  // ── Datos sensibles (Fase 3) ────────────────────────────────────────
  const consintio: 0 | 1 = rng.bool(0.60) ? 1 : 0;
  const discapacidad: DiscapacidadGen[] = [];
  let identidad: IdentidadGen | null = null;
  let fecha_consentimiento_sensibles: Date | null = null;

  if (consintio === 1) {
    fecha_consentimiento_sensibles = fecha_registro;

    const bucket = rng.pickWeighted<'severo' | 'poco' | 'no_declara' | 'base'>([
      ['severo', 7], ['poco', 5], ['no_declara', 3], ['base', 85],
    ]);
    const sinDificultad = catalogos.gradosDificultad.get('sin_dificultad')!;
    const pocaDificultad = catalogos.gradosDificultad.get('poca_dificultad')!;
    const muchaDificultad = catalogos.gradosDificultad.get('mucha_dificultad')!;
    const noPuedo = catalogos.gradosDificultad.get('no_puedo')!;
    const noDeclaraGrado = catalogos.gradosDificultad.get('no_declara')!;

    const dominiosMarcados = new Map<number, number>();
    if (bucket === 'severo') {
      const nDom = rng.int(1, 2);
      for (const d of rng.sample(catalogos.discapacidadDominios, nDom)) {
        dominiosMarcados.set(d.id, rng.bool(0.5) ? muchaDificultad : noPuedo);
      }
    } else if (bucket === 'poco') {
      const d = rng.pick(catalogos.discapacidadDominios);
      dominiosMarcados.set(d.id, pocaDificultad);
    } else if (bucket === 'no_declara') {
      const d = rng.pick(catalogos.discapacidadDominios);
      dominiosMarcados.set(d.id, noDeclaraGrado);
    }

    for (const dom of catalogos.discapacidadDominios) {
      discapacidad.push({ id_dominio: dom.id, id_grado: dominiosMarcados.get(dom.id) ?? sinDificultad });
    }

    const respSi = catalogos.respuestasAutoadscripcion.get('si')!;
    const respNo = catalogos.respuestasAutoadscripcion.get('no')!;
    const respNoDeclara = catalogos.respuestasAutoadscripcion.get('no_declara')!;

    const rIndigena = rng.pickWeighted<number>([[respSi, 10], [respNoDeclara, 3], [respNo, 87]]);
    const rHabla = rng.pickWeighted<number>([[respSi, 4], [respNoDeclara, 3], [respNo, 93]]);
    const rAfro = rng.pickWeighted<number>([[respSi, 2], [respNoDeclara, 3], [respNo, 95]]);

    identidad = {
      id_indigena: rIndigena,
      id_habla_lengua: rHabla,
      lengua_indigena: rHabla === respSi ? rng.pick(LENGUAS_INDIGENAS) : null,
      id_afromexicano: rAfro,
    };
  }

  // ── Trayectoria (Fase 4) — aplica a completos e incompletos ─────────
  const estudios: EstudioGen[] = [];
  const emprendimientos: EmprendimientoGen[] = [];
  const proyectos_sociales: ProyectoSocialGen[] = [];

  const estudiandoPosgrado = situacion.texto === 'Estudiando Posgrado';
  if (estudiandoPosgrado || rng.bool(0.13)) {
    const nivelClave = estudiandoPosgrado
      ? rng.pick(['maestria', 'doctorado', 'especialidad'])
      : rng.pick(['especialidad', 'maestria', 'doctorado', 'diplomado']);
    const estadoClave = estudiandoPosgrado
      ? 'en_curso'
      : rng.pickWeighted<string>([['concluido', 70], ['trunco', 15], ['en_curso', 15]]);
    estudios.push({
      id_nivel_estudio: catalogos.nivelesEstudio.get(nivelClave)!,
      nombre_programa: rng.pick(PROGRAMAS_POR_NIVEL[nivelClave]),
      institucion: rng.pick(INSTITUCIONES),
      id_estado_estudio: catalogos.estadosEstudio.get(estadoClave)!,
      anio: rng.int(anio_egreso, ANIO_ACTUAL),
    });
  }

  const esEmpresario = situacion.texto.startsWith('Empresario');
  if (esEmpresario || rng.bool(0.12)) {
    const rango = rng.pick(catalogos.rangosEmpleados);
    emprendimientos.push({
      nombre: generarEmpresaPropia(apellidoPrincipal),
      giro: rng.pick(GIROS_EMPRENDIMIENTO),
      anio_inicio: rng.int(anio_egreso, ANIO_ACTUAL),
      sigue_operando: esEmpresario ? 1 : (rng.bool(0.75) ? 1 : 0),
      id_rango_empleados: rango.id,
    });
  }

  if (rng.bool(0.20)) {
    const tipo = rng.pick(catalogos.tiposProyectoSocial);
    proyectos_sociales.push({
      nombre: rng.pick(PROYECTOS_SOCIALES_NOMBRES),
      id_tipo_proyecto: tipo.id,
      anio: rng.int(anio_egreso, ANIO_ACTUAL),
      organizacion: rng.pick(ORGANIZACIONES_SOCIALES),
    });
  }

  return {
    nombre_completo, genero_id, correo, telefono, ciudad_residencia, pais_nacimiento,
    carrera_id, anio_ingreso, periodo_ingreso, anio_egreso, estatus_titulacion,
    nivel_ingles_id: nivel_ingles.id, situacion_laboral_id: situacion.id,
    empresa, antiguedad_empleo_id,
    tiempo_primer_empleo_id: tiempoElegido.id, medio_primer_empleo_id, medio_primer_empleo_otro,
    primer_empleo_empresa, primer_empleo_puesto, ciudad_trabajo, satisfaccion_formacion,
    numero_control, linkedin, facebook, instagram, puesto_trabajo, coincidencia_laboral_id,
    foto_url: null, registro_completo, fecha_registro, revisado, fecha_revision, revisado_por,
    consintio_datos_sensibles: consintio, fecha_consentimiento_sensibles,
    habilidades, habilidad_otro, colaboraciones, colaboracion_otro, certificaciones,
    discapacidad, identidad, estudios, emprendimientos, proyectos_sociales,
    // autorizaciones se agregan aparte abajo (no forman parte de forzar())
    ...( { autorizaciones: { autorizo_estadisticas, autorizo_contacto, autorizo_eventos } } as any),
  } as any;
}

// ═══════════════════════════════════════════════════════════════════════
// Parejas de duplicados sembrados (Fase 6)
// ═══════════════════════════════════════════════════════════════════════
interface ParejaDuplicado {
  tipo: string;
  a: EgresadoGen & { autorizaciones: { autorizo_estadisticas: boolean; autorizo_contacto: boolean; autorizo_eventos: boolean } };
  b: EgresadoGen & { autorizaciones: { autorizo_estadisticas: boolean; autorizo_contacto: boolean; autorizo_eventos: boolean } };
}

function construirParejasDuplicados(catalogos: Catalogos): ParejaDuplicado[] {
  const pares: ParejaDuplicado[] = [];
  const gen = (forzar: Parameters<typeof generarRegistro>[1] = {}) =>
    generarRegistro(catalogos, forzar) as ParejaDuplicado['a'];
  // Resuelve el id de una carrera por su texto exacto del catálogo — nunca a mano.
  const idCarrera = (nombreExacto: string): number => {
    const c = catalogos.carreras.find((c) => c.texto === nombreExacto);
    if (!c) throw new Error(`Carrera no encontrada en el catálogo: "${nombreExacto}".`);
    return c.id;
  };

  // 1. Mismo numero_control, mismo nombre, correos distintos (ambos completos)
  {
    const carrera_id = idCarrera('Ingeniería en Sistemas Computacionales (Presencial / Virtual)');
    const genero_id = pickGeneroId(carrera_id);
    const nombre = generarNombreCompleto(genero_id);
    const anio_egreso = pickAnioEgreso();
    const anio_ingreso = anio_egreso - pickDiffIngreso();
    const numero_control = generarNumeroControl(anio_ingreso);
    const a = gen({ nombre_completo: nombre, genero_id, carrera_id, anio_egreso, anio_ingreso, registro_completo: 1, numero_control });
    const b = gen({ nombre_completo: nombre, genero_id, carrera_id, anio_egreso, anio_ingreso, registro_completo: 1, numero_control });
    pares.push({ tipo: 'Mismo número de control, mismo nombre, correos distintos', a, b });
  }

  // 2. numero_control "c21040123" vs "21040123" (cambio de carrera)
  {
    const carrera_id = idCarrera('Ingeniería en Gestión Empresarial');
    const genero_id = pickGeneroId(carrera_id);
    const nombre = generarNombreCompleto(genero_id);
    const anio_ingreso = 2021;
    const anio_egreso = anio_ingreso + pickDiffIngreso();
    // Se reservan en el set de unicidad para que ningún registro aleatorio
    // posterior pueda coincidir por azar con estos valores fijos.
    numerosControlUsados.add('c21040123');
    numerosControlUsados.add('21040123');
    const a = gen({ nombre_completo: nombre, genero_id, anio_ingreso, anio_egreso, registro_completo: 1, numero_control: 'c21040123' });
    const b = gen({ nombre_completo: nombre, genero_id, anio_ingreso, anio_egreso, registro_completo: 1, numero_control: '21040123' });
    pares.push({ tipo: 'numero_control con prefijo de cambio de carrera ("c") vs sin prefijo', a, b });
  }

  // 3. Mismo nombre y carrera, con acentos vs sin acentos
  {
    const carrera_id = idCarrera('Ingeniería Civil');
    const anio_egreso = pickAnioEgreso();
    const anio_ingreso = anio_egreso - pickDiffIngreso();
    const a = gen({ nombre_completo: 'José Hernández Bátiz', genero_id: ID_GENERO_MASCULINO, carrera_id, anio_egreso, anio_ingreso, registro_completo: 1 });
    const b = gen({ nombre_completo: 'Jose Hernandez Batiz', genero_id: ID_GENERO_MASCULINO, carrera_id, anio_egreso, anio_ingreso, registro_completo: 1 });
    pares.push({ tipo: 'Mismo nombre y carrera: con acentos vs sin acentos', a, b });
  }

  // 4. Mismo nombre, orden invertido
  {
    const carrera_id = idCarrera('Arquitectura');
    const anio_egreso = pickAnioEgreso();
    const anio_ingreso = anio_egreso - pickDiffIngreso();
    const a = gen({ nombre_completo: 'Pérez López Ana María', genero_id: ID_GENERO_FEMENINO, carrera_id, anio_egreso, anio_ingreso, registro_completo: 1 });
    const b = gen({ nombre_completo: 'Ana María Pérez López', genero_id: ID_GENERO_FEMENINO, carrera_id, anio_egreso, anio_ingreso, registro_completo: 1 });
    pares.push({ tipo: 'Mismo nombre con el orden de apellidos/nombres invertido', a, b });
  }

  // 5. Mismo teléfono, una letra distinta en el nombre
  {
    const carrera_id = pickCarreraId();
    const anio_egreso = pickAnioEgreso();
    const anio_ingreso = anio_egreso - pickDiffIngreso();
    const telefono = generarTelefono();
    const a = gen({ nombre_completo: 'Adrian Fernando Nevárez Soto', genero_id: ID_GENERO_MASCULINO, carrera_id, anio_egreso, anio_ingreso, telefono, registro_completo: 1 });
    const b = gen({ nombre_completo: 'Adrián Fernando Nevárez Soto', genero_id: ID_GENERO_MASCULINO, carrera_id, anio_egreso, anio_ingreso, telefono, registro_completo: 1 });
    pares.push({ tipo: 'Mismo teléfono, nombre con una letra distinta ("Adrian"/"Adrián")', a, b });
  }

  // 6. Mismo nombre y carrera, años de egreso con 1 año de diferencia
  {
    const carrera_id = idCarrera('Ingeniería Industrial (Presencial / A distancia)');
    const genero_id = pickGeneroId(carrera_id);
    const nombre = generarNombreCompleto(genero_id);
    const anioBase = pickAnioEgreso();
    const anioA = Math.min(ANIO_ACTUAL, anioBase);
    const anioB = anioA + 1 <= ANIO_ACTUAL ? anioA + 1 : anioA - 1;
    const a = gen({ nombre_completo: nombre, genero_id, carrera_id, anio_egreso: anioA, anio_ingreso: anioA - pickDiffIngreso(), registro_completo: 1 });
    const b = gen({ nombre_completo: nombre, genero_id, carrera_id, anio_egreso: anioB, anio_ingreso: anioB - pickDiffIngreso(), registro_completo: 1 });
    pares.push({ tipo: 'Mismo nombre y carrera, años de egreso con 1 año de diferencia', a, b });
  }

  // 7. Uno completo y otro incompleto (se quedó en etapa 1)
  {
    const carrera_id = idCarrera('Licenciatura en Administración (Presencial / A distancia)');
    const genero_id = pickGeneroId(carrera_id);
    const nombre = generarNombreCompleto(genero_id);
    const anio_egreso = pickAnioEgreso();
    const anio_ingreso = anio_egreso - pickDiffIngreso();
    const a = gen({ nombre_completo: nombre, genero_id, carrera_id, anio_egreso, anio_ingreso, registro_completo: 1 });
    const b = gen({ nombre_completo: nombre, genero_id, carrera_id, anio_egreso, anio_ingreso, registro_completo: 0 });
    pares.push({ tipo: 'Uno completó etapa 2, el otro se quedó en etapa 1 (mismo nombre y carrera)', a, b });
  }

  // 8. Mismo nombre, carrera distinta, datos distintos: falso positivo (NO es duplicado)
  {
    const nombre = 'Luis Fernando Ramírez Soto';
    const a = gen({ nombre_completo: nombre, genero_id: ID_GENERO_MASCULINO, carrera_id: idCarrera('Arquitectura'), registro_completo: 1 });
    const b = gen({ nombre_completo: nombre, genero_id: ID_GENERO_MASCULINO, carrera_id: idCarrera('Ingeniería Química'), registro_completo: 1 });
    pares.push({ tipo: 'Mismo nombre, carrera y datos distintos — NO es duplicado (falso positivo de control)', a, b });
  }

  return pares;
}

// ═══════════════════════════════════════════════════════════════════════
// Construcción del dataset completo (500 registros)
// ═══════════════════════════════════════════════════════════════════════
function construirDataset(catalogos: Catalogos): { registros: any[]; parejas: ParejaDuplicado[] } {
  const parejas = construirParejasDuplicados(catalogos);
  const registros: any[] = [];
  for (const p of parejas) {
    registros.push(p.a);
    registros.push(p.b);
  }
  const restantes = 500 - registros.length;
  for (let i = 0; i < restantes; i++) {
    registros.push(generarRegistro(catalogos));
  }
  return { registros, parejas };
}

// ═══════════════════════════════════════════════════════════════════════
// Ejecución
// ═══════════════════════════════════════════════════════════════════════
const TABLAS_HIJAS_EN_ORDEN = [
  'notificaciones',
  'autorizaciones',
  'certificaciones',
  'egresado_habilidades',
  'habilidades_otro',
  'egresado_colaboraciones',
  'colaboracion_otro',
  'egresado_discapacidad',
  'egresado_identidad',
  'egresado_estudios',
  'egresado_emprendimientos',
  'egresado_proyectos_sociales',
];
const TODAS_LAS_TABLAS_A_RESETEAR = [...TABLAS_HIJAS_EN_ORDEN, 'egresados'];

async function imprimirSimulacion(conn: mysql.Connection, registros: any[], parejas: ParejaDuplicado[]) {
  const [[{ n }]] = (await conn.query('SELECT COUNT(*) AS n FROM egresados')) as any[];

  const completos = registros.filter((r) => r.registro_completo === 1).length;
  const consintieron = registros.filter((r) => r.consintio_datos_sensibles === 1).length;
  const revisados = registros.filter((r) => r.revisado === 1).length;
  const conEstudio = registros.filter((r) => r.estudios.length > 0).length;
  const conEmprendimiento = registros.filter((r) => r.emprendimientos.length > 0).length;
  const conProyecto = registros.filter((r) => r.proyectos_sociales.length > 0).length;
  const inactivos = registros.filter((r) => r.empresa === null && r.ciudad_trabajo === null && r.puesto_trabajo === null).length;

  console.log('\n═══════════════════════════════════════════════════════');
  console.log('  MODO SIMULACIÓN — no se ha tocado la base de datos');
  console.log('═══════════════════════════════════════════════════════');
  console.log(`Base de datos destino : ${process.env.DB_NAME} @ ${process.env.DB_HOST}:${process.env.DB_PORT}`);
  console.log(`Egresados actuales    : ${n} (serían eliminados junto con todas sus tablas hijas)`);
  console.log('\nTablas que se BORRARÍAN (en este orden), con AUTO_INCREMENT reiniciado:');
  for (const t of TODAS_LAS_TABLAS_A_RESETEAR) console.log(`  - ${t}`);
  console.log('\nTablas que NO se tocan: usuarios, historial_actividad, reportes_historial, catálogos.');

  console.log('\n── Dataset que se generaría (500 egresados) ──────────────');
  console.log(`Registro completo (etapa 2)      : ${completos} (${(100 * completos / 500).toFixed(1)}%)`);
  console.log(`Incompletos (solo etapa 1)       : ${500 - completos}`);
  console.log(`Consintieron datos sensibles     : ${consintieron} (${(100 * consintieron / 500).toFixed(1)}%)`);
  console.log(`Revisados                        : ${revisados} (${(100 * revisados / 500).toFixed(1)}%)`);
  console.log(`Inactivos (sin empresa/puesto)   : ${inactivos}`);
  console.log(`Con estudio posterior            : ${conEstudio}`);
  console.log(`Con emprendimiento               : ${conEmprendimiento}`);
  console.log(`Con proyecto social               : ${conProyecto}`);

  console.log('\n── Parejas de duplicados sembrados (8) ────────────────────');
  for (const p of parejas) {
    console.log(`  • ${p.tipo}`);
    console.log(`      A: "${p.a.nombre_completo}" <${p.a.correo}> nc="${p.a.numero_control}" tel=${p.a.telefono} completo=${p.a.registro_completo}`);
    console.log(`      B: "${p.b.nombre_completo}" <${p.b.correo}> nc="${p.b.numero_control}" tel=${p.b.telefono} completo=${p.b.registro_completo}`);
  }

  console.log('\nPara aplicar estos cambios de verdad, ejecuta:');
  console.log('  npm run seed -- --confirmar\n');
}

function construirNotificaciones(registros: any[]): { tipo: string; titulo: string; descripcion: string; leida: 0 | 1; fecha_creacion: Date; idxRegistro: number }[] {
  const notifs: { tipo: string; titulo: string; descripcion: string; leida: 0 | 1; fecha_creacion: Date; idxRegistro: number }[] = [];
  registros.forEach((r, idx) => {
    if (r.autorizaciones.autorizo_contacto) {
      notifs.push({
        tipo: 'contacto',
        titulo: 'Egresado autorizó contacto',
        descripcion: `${r.nombre_completo} autorizó ser contactado para oportunidades laborales`,
        leida: rng.bool(0.70) ? 1 : 0,
        fecha_creacion: r.fecha_registro,
        idxRegistro: idx,
      });
    }
    if (r.autorizaciones.autorizo_eventos) {
      notifs.push({
        tipo: 'eventos',
        titulo: 'Egresado autorizó participación en eventos',
        descripcion: `${r.nombre_completo} autorizó ser contactado para participar en actividades académicas y eventos institucionales`,
        leida: rng.bool(0.70) ? 1 : 0,
        fecha_creacion: r.fecha_registro,
        idxRegistro: idx,
      });
    }
  });
  return notifs;
}

async function ejecutarSeed(conn: mysql.Connection, registros: any[], parejas: ParejaDuplicado[]) {
  // ── Fase 1: borrado (transaccional) ─────────────────────────────────
  await conn.beginTransaction();
  try {
    for (const tabla of TABLAS_HIJAS_EN_ORDEN) {
      await conn.query(`DELETE FROM ${tabla}`);
    }
    await conn.query('DELETE FROM egresados');
    await conn.commit();
  } catch (err) {
    await conn.rollback();
    throw err;
  }

  // ── Fase 1b: reinicio de AUTO_INCREMENT ─────────────────────────────
  // MySQL hace commit implícito en cualquier DDL (ALTER TABLE incluido),
  // así que esto NO puede ir dentro de la misma transacción que el
  // borrado ni la inserción. Se ejecuta aparte, ya con las tablas vacías:
  // si algo falla de aquí en adelante, basta con volver a correr el seed.
  for (const tabla of TODAS_LAS_TABLAS_A_RESETEAR) {
    await conn.query(`ALTER TABLE ${tabla} AUTO_INCREMENT = 1`);
  }

  // ── Fase 2: inserción (transaccional) ───────────────────────────────
  await conn.beginTransaction();
  try {
    for (const r of registros) {
      const [result] = await conn.query(
        `INSERT INTO egresados
          (nombre_completo, genero_id, correo, telefono, ciudad_residencia, pais_nacimiento,
           carrera_id, anio_ingreso, periodo_ingreso, anio_egreso, estatus_titulacion,
           nivel_ingles_id, situacion_laboral_id, empresa, antiguedad_empleo_id,
           tiempo_primer_empleo_id, medio_primer_empleo_id, medio_primer_empleo_otro,
           primer_empleo_empresa, primer_empleo_puesto, ciudad_trabajo, satisfaccion_formacion,
           fecha_registro, numero_control, linkedin, facebook, instagram, puesto_trabajo,
           coincidencia_laboral_id, foto_url, registro_completo,
           revisado, fecha_revision, revisado_por,
           consintio_datos_sensibles, fecha_consentimiento_sensibles)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          r.nombre_completo, r.genero_id, r.correo, r.telefono, r.ciudad_residencia, r.pais_nacimiento,
          r.carrera_id, r.anio_ingreso, r.periodo_ingreso, r.anio_egreso, r.estatus_titulacion,
          r.nivel_ingles_id, r.situacion_laboral_id, r.empresa, r.antiguedad_empleo_id,
          r.tiempo_primer_empleo_id, r.medio_primer_empleo_id, r.medio_primer_empleo_otro,
          r.primer_empleo_empresa, r.primer_empleo_puesto, r.ciudad_trabajo, r.satisfaccion_formacion,
          r.fecha_registro, r.numero_control, r.linkedin, r.facebook, r.instagram, r.puesto_trabajo,
          r.coincidencia_laboral_id, r.foto_url, r.registro_completo,
          r.revisado, r.fecha_revision, r.revisado_por,
          r.consintio_datos_sensibles, r.fecha_consentimiento_sensibles,
        ],
      );
      r.id_egresado = (result as any).insertId;

      await conn.query(
        `INSERT INTO autorizaciones (id_egresado, autorizo_estadisticas, autorizo_contacto, autorizo_eventos)
         VALUES (?, ?, ?, ?)`,
        [r.id_egresado, r.autorizaciones.autorizo_estadisticas ? 1 : 0, r.autorizaciones.autorizo_contacto ? 1 : 0, r.autorizaciones.autorizo_eventos ? 1 : 0],
      );

      for (const habId of r.habilidades) {
        await conn.query(`INSERT INTO egresado_habilidades (id_egresado, id_habilidad) VALUES (?, ?)`, [r.id_egresado, habId]);
      }
      if (r.habilidad_otro) {
        await conn.query(`INSERT INTO habilidades_otro (id_egresado, descripcion) VALUES (?, ?)`, [r.id_egresado, r.habilidad_otro]);
      }
      for (const colabId of r.colaboraciones) {
        await conn.query(`INSERT INTO egresado_colaboraciones (id_egresado, id_colaboracion) VALUES (?, ?)`, [r.id_egresado, colabId]);
      }
      if (r.colaboracion_otro) {
        await conn.query(`INSERT INTO colaboracion_otro (id_egresado, descripcion) VALUES (?, ?)`, [r.id_egresado, r.colaboracion_otro]);
      }
      for (const cert of r.certificaciones) {
        await conn.query(`INSERT INTO certificaciones (id_egresado, nombre_certificacion) VALUES (?, ?)`, [r.id_egresado, cert]);
      }
      for (const d of r.discapacidad) {
        await conn.query(`INSERT INTO egresado_discapacidad (id_egresado, id_dominio, id_grado) VALUES (?, ?, ?)`, [r.id_egresado, d.id_dominio, d.id_grado]);
      }
      if (r.identidad) {
        const i = r.identidad;
        await conn.query(
          `INSERT INTO egresado_identidad (id_egresado, id_indigena, id_habla_lengua, lengua_indigena, id_afromexicano) VALUES (?, ?, ?, ?, ?)`,
          [r.id_egresado, i.id_indigena, i.id_habla_lengua, i.lengua_indigena, i.id_afromexicano],
        );
      }
      for (const e of r.estudios) {
        await conn.query(
          `INSERT INTO egresado_estudios (id_egresado, id_nivel_estudio, nombre_programa, institucion, id_estado_estudio, anio) VALUES (?, ?, ?, ?, ?, ?)`,
          [r.id_egresado, e.id_nivel_estudio, e.nombre_programa, e.institucion, e.id_estado_estudio, e.anio],
        );
      }
      for (const e of r.emprendimientos) {
        await conn.query(
          `INSERT INTO egresado_emprendimientos (id_egresado, nombre, giro, anio_inicio, sigue_operando, id_rango_empleados) VALUES (?, ?, ?, ?, ?, ?)`,
          [r.id_egresado, e.nombre, e.giro, e.anio_inicio, e.sigue_operando, e.id_rango_empleados],
        );
      }
      for (const p of r.proyectos_sociales) {
        await conn.query(
          `INSERT INTO egresado_proyectos_sociales (id_egresado, nombre, id_tipo_proyecto, anio, organizacion) VALUES (?, ?, ?, ?, ?)`,
          [r.id_egresado, p.nombre, p.id_tipo_proyecto, p.anio, p.organizacion],
        );
      }
    }

    const notificaciones = construirNotificaciones(registros);
    for (const n of notificaciones) {
      const idEgresado = registros[n.idxRegistro].id_egresado;
      await conn.query(
        `INSERT INTO notificaciones (tipo, titulo, descripcion, leida, fecha_creacion, id_egresado) VALUES (?, ?, ?, ?, ?, ?)`,
        [n.tipo, n.titulo, n.descripcion, n.leida, n.fecha_creacion, idEgresado],
      );
    }

    // ── Verificación automática (dentro de la transacción, antes del commit) ──
    await verificarIntegridad(conn);

    await conn.commit();
  } catch (err) {
    await conn.rollback();
    throw err;
  }
}

async function verificarIntegridad(conn: mysql.Connection): Promise<void> {
  const fallos: string[] = [];
  const q = async (sql: string) => (await conn.query(sql))[0] as any[];

  const [{ n: total }] = await q('SELECT COUNT(*) AS n FROM egresados');
  if (total !== 500) fallos.push(`Se esperaban 500 egresados, hay ${total}.`);

  const [{ n: inactivosConDatos }] = await q(`
    SELECT COUNT(*) AS n FROM egresados e
    JOIN situacion_laboral sl ON e.situacion_laboral_id = sl.id_situacion
    WHERE sl.situacion IN ('Desempleado', 'Estudiando Posgrado', 'Dedicado al hogar u otras actividades')
      AND (e.empresa IS NOT NULL OR e.puesto_trabajo IS NOT NULL OR e.ciudad_trabajo IS NOT NULL)
  `);
  if (inactivosConDatos > 0) fallos.push(`${inactivosConDatos} registros inactivos tienen empresa/puesto/ciudad_trabajo no NULL.`);

  const [{ n: textosVacios }] = await q(`
    SELECT COUNT(*) AS n FROM egresados
    WHERE TRIM(COALESCE(empresa, '')) = '' AND empresa IS NOT NULL
       OR TRIM(COALESCE(puesto_trabajo, '')) = '' AND puesto_trabajo IS NOT NULL
       OR LOWER(COALESCE(empresa, '')) LIKE '%sin empleo%'
       OR LOWER(COALESCE(empresa, '')) LIKE '%desempleado%'
       OR LOWER(COALESCE(empresa, '')) LIKE '%no aplica%'
       OR LOWER(COALESCE(empresa, '')) = 'ninguna'
       OR LOWER(COALESCE(puesto_trabajo, '')) LIKE '%sin empleo%'
       OR LOWER(COALESCE(puesto_trabajo, '')) LIKE '%desempleado%'
       OR LOWER(COALESCE(puesto_trabajo, '')) LIKE '%no aplica%'
       OR LOWER(COALESCE(puesto_trabajo, '')) = 'ninguna'
  `);
  if (textosVacios > 0) fallos.push(`${textosVacios} registros con empresa/puesto vacío o con texto tipo "sin empleo".`);

  const [{ n: diffFueraDeRango }] = await q(`
    SELECT COUNT(*) AS n FROM egresados
    WHERE anio_ingreso IS NULL OR (anio_egreso - anio_ingreso) NOT BETWEEN 4 AND 15
  `);
  if (diffFueraDeRango > 0) fallos.push(`${diffFueraDeRango} registros con (anio_egreso - anio_ingreso) fuera de 4..15.`);

  const [{ n: sinConsentimientoConDatos }] = await q(`
    SELECT COUNT(*) AS n FROM egresados e
    WHERE e.consintio_datos_sensibles = 0
      AND (
        EXISTS (SELECT 1 FROM egresado_discapacidad d WHERE d.id_egresado = e.id_egresado)
        OR EXISTS (SELECT 1 FROM egresado_identidad i WHERE i.id_egresado = e.id_egresado)
      )
  `);
  if (sinConsentimientoConDatos > 0) fallos.push(`${sinConsentimientoConDatos} egresados sin consentimiento tienen filas en discapacidad/identidad.`);

  const [{ n: discapacidadIncompleta }] = await q(`
    SELECT COUNT(*) AS n FROM (
      SELECT id_egresado, COUNT(*) AS c FROM egresado_discapacidad GROUP BY id_egresado HAVING c <> 6
    ) t
  `);
  if (discapacidadIncompleta > 0) fallos.push(`${discapacidadIncompleta} egresados con consentimiento no tienen exactamente 6 filas de discapacidad.`);

  const [{ n: generoInvalido }] = await q(`
    SELECT COUNT(*) AS n FROM egresados e
    JOIN generos g ON e.genero_id = g.id_genero
    WHERE g.genero NOT IN ('Femenino', 'Masculino')
  `);
  if (generoInvalido > 0) fallos.push(`${generoInvalido} registros con género distinto de Femenino/Masculino.`);

  const [{ n: completosSinHabilidad }] = await q(`
    SELECT COUNT(*) AS n FROM egresados e
    WHERE e.registro_completo = 1
      AND NOT EXISTS (SELECT 1 FROM egresado_habilidades h WHERE h.id_egresado = e.id_egresado)
  `);
  if (completosSinHabilidad > 0) fallos.push(`${completosSinHabilidad} registros completos sin ninguna habilidad.`);

  const [{ n: completosSinColaboracion }] = await q(`
    SELECT COUNT(*) AS n FROM egresados e
    WHERE e.registro_completo = 1
      AND NOT EXISTS (SELECT 1 FROM egresado_colaboraciones c WHERE c.id_egresado = e.id_egresado)
  `);
  if (completosSinColaboracion > 0) fallos.push(`${completosSinColaboracion} registros completos sin ninguna colaboración.`);

  const listaPaises = PAISES_VALIDOS.map((p) => `'${p.replace(/'/g, "''")}'`).join(', ');
  const [{ n: ciudadTrabajoSinPais }] = await q(`
    SELECT COUNT(*) AS n FROM egresados
    WHERE ciudad_trabajo IS NOT NULL
      AND TRIM(SUBSTRING_INDEX(ciudad_trabajo, ',', -1)) NOT IN (${listaPaises})
  `);
  if (ciudadTrabajoSinPais > 0) fallos.push(`${ciudadTrabajoSinPais} registros con ciudad_trabajo cuyo último segmento no es un país reconocido.`);

  if (fallos.length > 0) {
    throw new Error('Verificación de integridad fallida:\n  - ' + fallos.join('\n  - '));
  }
}

async function imprimirResumenFinal(conn: mysql.Connection) {
  const q = async (sql: string) => (await conn.query(sql))[0] as any[];
  const [{ n: total }] = await q('SELECT COUNT(*) AS n FROM egresados');
  const [{ n: completos }] = await q('SELECT COUNT(*) AS n FROM egresados WHERE registro_completo = 1');
  const [{ n: consintieron }] = await q('SELECT COUNT(*) AS n FROM egresados WHERE consintio_datos_sensibles = 1');
  const [{ n: revisados }] = await q('SELECT COUNT(*) AS n FROM egresados WHERE revisado = 1');
  const [{ n: notifs }] = await q('SELECT COUNT(*) AS n FROM notificaciones');
  const [{ n: estudios }] = await q('SELECT COUNT(*) AS n FROM egresado_estudios');
  const [{ n: emprendimientos }] = await q('SELECT COUNT(*) AS n FROM egresado_emprendimientos');
  const [{ n: proyectos }] = await q('SELECT COUNT(*) AS n FROM egresado_proyectos_sociales');
  const [{ n: certs }] = await q('SELECT COUNT(*) AS n FROM certificaciones');

  console.log('\n═══════════════════════════════════════════════════════');
  console.log('  SEED APLICADO — verificación de integridad OK');
  console.log('═══════════════════════════════════════════════════════');
  console.log(`egresados                : ${total}`);
  console.log(`  registro_completo = 1  : ${completos} (${(100 * completos / total).toFixed(1)}%)`);
  console.log(`  consintio sensibles    : ${consintieron} (${(100 * consintieron / total).toFixed(1)}%)`);
  console.log(`  revisado = 1           : ${revisados} (${(100 * revisados / total).toFixed(1)}%)`);
  console.log(`notificaciones           : ${notifs}`);
  console.log(`egresado_estudios        : ${estudios}`);
  console.log(`egresado_emprendimientos : ${emprendimientos}`);
  console.log(`egresado_proyectos_sociales : ${proyectos}`);
  console.log(`certificaciones          : ${certs}`);
}

function escribirMarkdownDuplicados(parejas: ParejaDuplicado[]) {
  const filasTabla: any[] = [];
  parejas.forEach((p, i) => {
    filasTabla.push({ par: i + 1, tipo: p.tipo, id: (p.a as any).id_egresado, nombre: p.a.nombre_completo, correo: p.a.correo, numero_control: p.a.numero_control || '(vacío)' });
    filasTabla.push({ par: i + 1, tipo: '', id: (p.b as any).id_egresado, nombre: p.b.nombre_completo, correo: p.b.correo, numero_control: p.b.numero_control || '(vacío)' });
  });
  console.log('\n── Parejas de duplicados sembrados ─────────────────────────');
  console.table(filasTabla);

  const filas: string[] = [
    '# Parejas de duplicados sembrados',
    '',
    'Generadas por `scripts/seed-egresados.ts` (semilla determinista = ' + SEMILLA + ') para probar la detección de duplicados (Fase 6).',
    '',
    '| # | Tipo | id | nombre_completo | correo | numero_control | registro_completo |',
    '|---|------|----|--------------------|--------|-----------------|--------------------|',
  ];
  parejas.forEach((p, i) => {
    filas.push(`| ${i + 1} | ${p.tipo} | ${(p.a as any).id_egresado} | ${p.a.nombre_completo} | ${p.a.correo} | ${p.a.numero_control || '(vacío)'} | ${p.a.registro_completo} |`);
    filas.push(`|   |      | ${(p.b as any).id_egresado} | ${p.b.nombre_completo} | ${p.b.correo} | ${p.b.numero_control || '(vacío)'} | ${p.b.registro_completo} |`);
  });
  const destino = join(__dirname, 'seed-duplicados.md');
  writeFileSync(destino, filas.join('\n') + '\n', 'utf-8');
  console.log(`\nTabla de duplicados guardada en ${destino}`);
}

// ═══════════════════════════════════════════════════════════════════════
// Main
// ═══════════════════════════════════════════════════════════════════════
async function main() {
  const confirmar = process.argv.includes('--confirmar');

  const conn = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    charset: 'utf8mb4',
    timezone: 'Z', // mismo criterio que TypeOrmModule.forRoot() en app.module.ts
  });

  try {
    console.log('Cargando catálogos desde la base de datos...');
    const catalogos = await cargarCatalogos(conn);
    prepararTablasDinamicas(catalogos);

    console.log('Generando 500 registros deterministas (semilla = ' + SEMILLA + ')...');
    const { registros, parejas } = construirDataset(catalogos);

    if (!confirmar) {
      await imprimirSimulacion(conn, registros, parejas);
      return;
    }

    console.log('Aplicando cambios: borrando egresados actuales e insertando 500 nuevos...');
    await ejecutarSeed(conn, registros, parejas);
    await imprimirResumenFinal(conn);
    escribirMarkdownDuplicados(parejas);
  } finally {
    await conn.end();
  }
}

main().catch((err) => {
  console.error('\nEl seed FALLÓ y se revirtió (rollback):');
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
