# API Reference — Egresados ITD

Backend NestJS. Base URL de desarrollo: `http://localhost:3000`

> Fuente de verdad: los controladores, DTOs y servicios de `src/`. Si algo
> de este archivo no coincide con el código, el código gana y hay que
> corregir este archivo. El inventario exacto de rutas sale del log de
> arranque (`[RouterExplorer] Mapped {...}`): hoy son **113 rutas**.

---

## Convenciones que hay que saber antes de consumir la API

**Validación global.** `main.ts` registra `ValidationPipe` con
`whitelist`, `forbidNonWhitelisted` y `transform`. En los endpoints que usan
un DTO de clase, **cualquier campo o query param que no esté en el DTO
devuelve `400`**. Los que reciben el body tipado en línea
(`{ ... }`, sin clase) no se validan.

**Tipos que devuelve mysql2 (la trampa de siempre).** Casi todos los
reportes se arman con `dataSource.query()` crudo, y ahí:

| Origen en SQL | Llega en JSON como | Ejemplo |
|---|---|---|
| `COUNT()`, `SUM()` | **string** | `"total": "159"` |
| `AVG()`, `ROUND()`, porcentajes | **string** | `"pct_titulados": "62.5"` |
| columnas `TINYINT` (booleanos) | **number `0`/`1`** | `"revisado": 1` |
| columnas `YEAR` / `INT` | number | `"anio_egreso": 2019` |
| `DATETIME` / `TIMESTAMP` | string ISO | `"2026-09-04T07:09:37.000Z"` |

Excepciones documentadas en cada endpoint: los servicios que pasan los
agregados por `Number()` (dashboard, duplicados, empresas, `pendientes-revision`,
`directorio.total`, filtros) y los endpoints que usan el repositorio de
TypeORM sobre columnas `boolean` (notificaciones, `GET /autorizaciones`),
que sí devuelven `true`/`false`.

**Respuestas `null`.** Cuando un servicio devuelve `null`, Nest responde
`200` con **cuerpo vacío** (no el texto `null`). En el front, `http.get()`
lo entrega como `null`.

**Exports.** Todos los `.../export/pdf` y `.../export/excel` responden un
binario con `Content-Disposition: attachment; filename="<nombre>_<AAAA-MM-DD>.<ext>"`.

---

## Autenticación

El sistema usa **JWT Bearer Token** (expira en **8 h**).

### Obtener token

```
POST /usuarios/login
```

**Auth:** Público (el controlador de usuarios no tiene guard de clase)

**Body:**
```json
{ "usuario": "<usuario>", "contrasena": "<contraseña>" }
```

> Las credenciales NO se documentan aquí a propósito: no se guardan
> contraseñas en el repositorio. Ver "Token para desarrollo local".

**Respuesta 200:**
```json
{
  "mensaje": "Login exitoso",
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "usuario": {
    "id_usuario": 1,
    "usuario": "<usuario>",
    "nombre_completo": "<nombre>",
    "rol": "admin",
    "estado": "activo",
    "ultimo_acceso": "2026-09-28T10:00:00.000Z",
    "fecha_creacion": "2026-01-01T00:00:00.000Z"
  }
}
```

**Respuesta 401:** `"Usuario o contraseña incorrectos"` (también si el usuario está `inactivo`).

> El body está tipado en línea (sin DTO) y se valida a mano: sin body, con
> `{}` o sin `usuario`/`contrasena` (o si no son string) responde **`401`**
> con el mismo mensaje genérico. El mensaje nunca distingue "falta el
> usuario", "no existe" o "contraseña incorrecta".

**Payload del token:** `{ sub: id_usuario, usuario, nombre_completo, rol }`.
`JwtStrategy` expone en `req.user` solo `{ id_usuario, usuario, rol }`.

**Rate limit:** 5 intentos por minuto por IP (`@Throttle` en el endpoint). Al superarlo devuelve `429 Too Many Requests`.

### Token para desarrollo local

Para probar endpoints protegidos con curl, Yaak o scripts de verificación,
hay dos caminos. Ninguno requiere credenciales escritas en el repo.

**Opción A — desde el panel.** Inicia sesión en egresados-back y copia el
token en DevTools → Application → Local Storage.

**Opción B — firmar uno.** Primero identifica un usuario admin real:

```sql
SELECT id_usuario, usuario FROM usuarios WHERE rol = 'admin' LIMIT 1;
```

Y desde la raíz del proyecto:

```bash
node -e "require('dotenv').config(); console.log(require('jsonwebtoken').sign({ sub: 1, usuario: 'ADMIN', rol: 'admin' }, process.env.JWT_SECRET, { expiresIn: '2h' }))"
```

Cambia `sub` y `usuario` por los valores que devolvió la consulta. El
`JWT_SECRET` sale del `.env`, que está en `.gitignore`. `sub` debe ser un
`id_usuario` real: las acciones auditadas (`registrarAccion`) lo usan como
FK en `historial_actividad`.

Ese token es solo para desarrollo local. **Nunca lo escribas en un archivo
del proyecto, ni en `environment.ts`, ni en un script que quede guardado.**

Uso:

```bash
curl -H "Authorization: Bearer <token>" http://localhost:3000/duplicados/resumen
```

### Usar el token en Angular

El panel lo maneja con un interceptor global (`auth.interceptor.ts`) que
lee el token de `localStorage` y lo agrega a cada petición. No hay que
poner headers a mano en ningún service.

```
Authorization: Bearer <access_token>
```

### Roles y acceso

| Rol | Descripción |
|---|---|
| `admin` | Acceso completo a todos los endpoints |
| `invitado` | Lectura de reportes (estadísticas, directorio, dashboard, vinculación) y notificaciones |

**Cómo se decide el acceso.** No hay guard global. Cada controlador
protegido declara `@UseGuards(JwtAuthGuard, RolesGuard)`:

- `@Public()` en un método salta el `JwtAuthGuard`.
- `RolesGuard` **deja pasar si no hay `@Roles`**. Por eso un endpoint sin
  `@Roles('admin')` es accesible para cualquier usuario autenticado.
- `/inclusion`, `/duplicados`, `/admin/empresas`, `/correo` y seis catálogos llevan
  `@Roles('admin')` **a nivel de clase**: todo el controlador es solo admin.
- Los controladores de catálogo sin guards son públicos.

### Endpoints públicos (sin token)

- `GET /`
- `POST /usuarios/login`
- `POST /egresados/etapa1`
- `PATCH /egresados/etapa2/:id`
- `GET /egresados/buscar`
- Los catálogos públicos (ver sección "Catálogos")

### Errores de autenticación

| Código | Significado |
|---|---|
| `401 Unauthorized` | Token ausente, inválido o expirado |
| `403 Forbidden` | Token válido pero el rol no tiene permiso |
| `429 Too Many Requests` | Rate limit superado |

---

## Raíz

```
GET /
```

**Auth:** Público

**Respuesta 200** (texto plano):
```
Sistema Backend de APIs para la plataforma de Seguimiento de Egresados del ITD
```

---

## Módulo: Egresados

Controlador con `@UseGuards(JwtAuthGuard, RolesGuard)` a nivel de clase.
Sin `@Roles` = cualquier usuario autenticado.

### Formulario público — Registro etapa 1

```
POST /egresados/etapa1
```

**Auth:** Público
**Content-Type:** `multipart/form-data` **o** `application/json`

Con `multipart/form-data`, el campo `data` lleva el JSON del egresado como
string y `foto` es el archivo de imagen (opcional). Si no viene `data`, el
body completo se toma como el JSON del egresado (útil para pruebas con
`application/json`, sin foto).

```
data: '{"nombre_completo":"Juan Pérez",...}'   ← string JSON
foto: <archivo>                                  ← opcional, max 2MB, jpg/png/webp
```

> Este endpoint valida el DTO a mano con `validate(dto)` (sin
> `whitelist`), así que los campos que NO están en el DTO se **ignoran en
> silencio** en lugar de dar 400.

**Campos del JSON en `data`** (fuente: `src/egresados/dto/create-egresado-etapa1.dto.ts`):

| Campo | Tipo | Requerido | Notas |
|---|---|---|---|
| `nombre_completo` | string | ✓ | |
| `genero` | string | ✓ | Valor del catálogo `/generos` |
| `correo` | string (email) | ✓ | Se guarda en minúsculas y sin espacios |
| `telefono` | string | ✓ | |
| `ciudad_residencia` | string | ✓ | |
| `pais_nacimiento` | string | — | Máx. 80 |
| `carrera` | string | ✓ | Valor del catálogo `/carreras` |
| `anio_ingreso` | number | — | 1955 – año actual (`ANIO_INGRESO_MIN` y `@MaxCurrentYear()`). No puede ser mayor que `anio_egreso` (400) |
| `periodo_ingreso` | string | — | `'Enero - Junio'` \| `'Agosto - Diciembre'` \| `'No lo recuerdo'` |
| `anio_egreso` | number | ✓ | 1960 – año actual (`ANIO_EGRESO_MIN` y `@MaxCurrentYear()`). Los mínimos viven en `src/common/constants/limites-anio.ts` |
| `estatus_titulacion` | string | ✓ | Valor del catálogo `/titulacion` (se guarda como texto, no se valida contra el catálogo) |
| `nivel_ingles` | string | ✓ | Valor del catálogo `/niveles-ingles` |
| `situacion_laboral` | string | ✓ | Valor del catálogo `/situacion-laboral` |
| `empresa` | string | — | Empleo actual |
| `antiguedad_empleo` | string | — | Valor del catálogo `/antiguedad` |
| `ciudad_trabajo` | string | — | |
| `puesto_trabajo` | string | — | Máx. 150. Puesto actual (antes era de la etapa 2) |
| `tiempo_primer_empleo` | string | ✓ | Valor de la tabla `tiempo_primer_empleo` (ver nota) |
| `medio_primer_empleo` | string | condicional | Requerido salvo que `tiempo_primer_empleo = 'Aún no he conseguido empleo'`. Valor de la tabla `medio_primer_empleo` |
| `medio_primer_empleo_otro` | string | condicional | Requerido si `medio_primer_empleo = 'Otra'` |
| `primer_empleo_empresa` | string | — | Máx. 150. Se descarta si aún no consiguió empleo |
| `primer_empleo_puesto` | string | — | Máx. 150. Se descarta si aún no consiguió empleo |
| `facebook` | string | — | |
| `instagram` | string | — | |
| `satisfaccion_formacion` | number | ✓ | 1–5 |
| `autorizaciones.estadisticas` | boolean | ✓ | |
| `autorizaciones.contacto` | boolean | ✓ | |
| `autorizaciones.eventos` | boolean | ✓ | |
| `consintio_datos_sensibles` | boolean | — | Puerta de consentimiento (LFPDPPP). Si no es `true`, `discapacidad` e `identidad` se **ignoran por completo** |
| `discapacidad` | `DiscapacidadRespuesta[]` | — | Máx. 6 (uno por dominio, sin repetir) |
| `identidad` | `Identidad` | — | |
| `estudios` | `EstudioPosterior[]` | — | Máx. 5 |
| `emprendimientos` | `Emprendimiento[]` | — | Máx. 5 |
| `proyectos_sociales` | `ProyectoSocial[]` | — | Máx. 5 |

**Valores de `tiempo_primer_empleo` y `medio_primer_empleo`.** No hay
endpoint de catálogo para estas dos tablas; el servicio resuelve el texto
contra la BD. Valores actuales:

- `tiempo_primer_empleo.rango`: `Menos de 3 meses`, `De 3 a 6 meses`, `De 6 meses a 1 año`, `De 1 a 2 años`, `Más de 2 años`, `Aún no he conseguido empleo`
- `medio_primer_empleo.medio`: `LinkedIn`, `Otra plataforma de empleo`, `Bolsa de trabajo ITD`, `Por recomendación`, `Otra`

**Objetos anidados.** Todos los catálogos de estos bloques viajan como
**`clave`** del catálogo (no como descripción). Una clave inválida → 400
sin escribir nada.

```typescript
interface DiscapacidadRespuesta {
  dominio: string;          // clave de /discapacidad-dominios (máx. 20)
  grado: string;            // clave de /grados-dificultad (máx. 20)
}

interface Identidad {
  indigena: string;         // clave de /respuestas-autoadscripcion (si | no | no_declara)
  habla_lengua: string;     // idem
  lengua_indigena?: string; // máx. 80; solo se guarda si habla_lengua = 'si'
  afromexicano: string;     // idem
}

interface EstudioPosterior {
  nivel: string;            // clave de /niveles-estudio (máx. 30)
  nombre_programa: string;  // máx. 150
  institucion: string;      // máx. 150
  estado: string;           // clave de /estados-estudio (máx. 30)
  anio?: number;            // 1950 – año actual
}

interface Emprendimiento {
  nombre: string;           // máx. 150
  giro: string;             // máx. 150
  anio_inicio?: number;     // 1950 – año actual
  sigue_operando?: boolean; // default true; solo un false explícito lo apaga
  rango_empleados?: string; // clave de /rangos-empleados (máx. 30)
}

interface ProyectoSocial {
  nombre: string;           // máx. 150
  tipo: string;             // clave de /tipos-proyecto-social (máx. 30)
  anio?: number;            // 1950 – año actual
  organizacion?: string;    // máx. 150
}
```

**Respuesta 201:**
```json
{ "id_egresado": 42, "mensaje": "Etapa 1 guardada correctamente." }
```

**Errores:**
- `409` si el correo ya tiene un registro **completo** ("Ya tenemos registradas tus respuestas..."). Si el registro previo del mismo correo está a medias, se borra y se reemplaza dentro de la misma transacción.
- `400` si un valor de catálogo no existe, o si `anio_ingreso > anio_egreso`.

---

### Formulario público — Registro etapa 2

```
PATCH /egresados/etapa2/:id
```

**Auth:** Público
**Params:** `id` = `id_egresado` devuelto por etapa 1

**Body:**
```json
{
  "correo": "juan@example.com",
  "nombre_completo": "Juan Pérez",
  "numero_control": "18040001",
  "linkedin": "https://linkedin.com/in/juan",
  "coincidencia_laboral": "Total",
  "certificaciones": "AWS Solutions Architect",
  "habilidades": ["Trabajo en equipo", "Liderazgo"],
  "habilidad_otro": "Gestión de proyectos",
  "colaboraciones": ["Conferencias", "Mentorías"],
  "colaboracion_otro": ""
}
```

| Campo | Tipo | Requerido | Notas |
|---|---|---|---|
| `correo` | string (email) | ✓ | Se valida pero el servicio no lo usa |
| `nombre_completo` | string | ✓ | Se valida pero el servicio no lo usa |
| `numero_control` | string | ✓ | |
| `linkedin` | string | — | |
| `coincidencia_laboral` | string | ✓ | Valor del catálogo `/coincidencia` |
| `certificaciones` | string | — | **Una** certificación (texto libre) |
| `habilidades` | string[] | ✓ | Valores del catálogo `/habilidades`; los que no existen se omiten sin error |
| `habilidad_otro` | string | — | |
| `colaboraciones` | string[] | ✓ | Valores del catálogo `/colaboraciones`; los que no existen se omiten sin error |
| `colaboracion_otro` | string | — | |

> `puesto_trabajo` ya **no** es de la etapa 2 (se movió a la etapa 1).
> Mandarlo aquí devuelve `400` por `forbidNonWhitelisted`.

**Respuesta 200:**
```json
{ "mensaje": "Etapa 2 completada. Registro finalizado." }
```

**Errores:** `404` si el egresado no existe. `400` si `coincidencia_laboral` no está en el catálogo.

---

### Buscar egresado por correo

```
GET /egresados/buscar?correo=juan@example.com
```

**Auth:** Público
**Uso:** Verificar si un correo ya está registrado antes de mostrar el formulario.

**Respuesta 200:**
```json
{ "id_egresado": 42, "registro_completo": true }
```

Si no existe, responde `200` con **cuerpo vacío**.

---

### Listar todos los egresados

```
GET /egresados
```

**Auth:** Cualquier usuario autenticado

**Respuesta 200:** Array de la entidad `Egresado` (columnas crudas, sin joins, con los `*_id`):

```typescript
interface Egresado {
  id_egresado: number;
  nombre_completo: string;
  genero_id: number;
  correo: string;
  telefono: string;
  ciudad_residencia: string;
  pais_nacimiento: string | null;
  carrera_id: number;
  anio_ingreso: number | null;
  periodo_ingreso: string | null;
  anio_egreso: number;
  nivel_ingles_id: number;
  empresa: string | null;
  antiguedad_empleo_id: number | null;
  tiempo_primer_empleo_id: number | null;
  medio_primer_empleo_id: number | null;
  medio_primer_empleo_otro: string | null;
  primer_empleo_empresa: string | null;
  primer_empleo_puesto: string | null;
  ciudad_trabajo: string | null;
  fecha_registro: string;
  numero_control: string;          // '' hasta completar la etapa 2
  linkedin: string | null;
  facebook: string | null;
  instagram: string | null;
  puesto_trabajo: string | null;
  coincidencia_laboral_id: number;
  estatus_titulacion: string;
  situacion_laboral_id: number;
  satisfaccion_formacion: number;
  revisado: 0 | 1;
  fecha_revision: string | null;
  revisado_por: string | null;
  foto_url: string | null;
  registro_completo: 0 | 1;
}
```

---

### Listar egresados con detalles

```
GET /egresados/detalles
```

**Auth:** Cualquier usuario autenticado

**Respuesta 200:** Array ordenado por `id_egresado DESC`, con joins a los catálogos:

```typescript
interface EgresadoDetalle {
  id_egresado: number;
  nombre_completo: string;
  correo: string;
  telefono: string;
  ciudad_residencia: string;
  anio_egreso: number;
  empresa: string | null;
  ciudad_trabajo: string | null;
  fecha_registro: string;
  numero_control: string;
  linkedin: string | null;
  puesto_trabajo: string | null;
  estatus_titulacion: string;
  satisfaccion_formacion: number;
  foto_url: string | null;
  revisado: 0 | 1;
  fecha_revision: string | null;
  revisado_por: string | null;
  genero: string;
  nombre_carrera: string;
  nivel_ingles: string;
  antiguedad_empleo: string | null;
  coincidencia_laboral: string;
  situacion_laboral: string;
  autorizo_estadisticas: 0 | 1 | null;
  autorizo_contacto: 0 | 1 | null;
  autorizo_eventos: 0 | 1 | null;
}
```

---

### Perfil completo de un egresado

```
GET /egresados/:id/perfil
```

**Auth:** Cualquier usuario autenticado

**Respuesta 200:** Datos con joins + arreglos de relaciones. **No** incluye
`revisado`, `fecha_revision` ni `revisado_por`.

```typescript
interface EgresadoPerfil {
  id_egresado: number;
  nombre_completo: string;
  correo: string;
  telefono: string;
  ciudad_residencia: string;
  pais_nacimiento: string | null;
  anio_ingreso: number | null;
  periodo_ingreso: string | null;
  anio_egreso: number;
  empresa: string | null;
  ciudad_trabajo: string | null;
  fecha_registro: string;
  numero_control: string;
  linkedin: string | null;
  puesto_trabajo: string | null;
  estatus_titulacion: string;
  satisfaccion_formacion: number;
  foto_url: string | null;
  facebook: string | null;
  instagram: string | null;
  medio_primer_empleo_otro: string | null;
  primer_empleo_empresa: string | null;
  primer_empleo_puesto: string | null;
  genero: string;
  nombre_carrera: string;
  nivel_ingles: string;
  antiguedad_empleo: string | null;
  coincidencia_laboral: string;
  situacion_laboral: string;
  tiempo_primer_empleo: string | null;
  medio_primer_empleo: string | null;  // si fue 'Otra': "Otra: <texto libre>"
  autorizo_estadisticas: 0 | 1 | null;
  autorizo_contacto: 0 | 1 | null;
  autorizo_eventos: 0 | 1 | null;
  certificaciones: string[];
  habilidades: string[];
  habilidades_otro: string[];
  colaboraciones: string[];
  colaboraciones_otro: string[];
  estudios: { nivel: string; nombre_programa: string; institucion: string; estado: string; anio: number | null }[];
  emprendimientos: { nombre: string; giro: string; anio_inicio: number | null; sigue_operando: boolean; rango_empleados: string | null }[];
  proyectos_sociales: { nombre: string; tipo: string; anio: number | null; organizacion: string | null }[];
}
```

Los catálogos de `estudios`, `emprendimientos` y `proyectos_sociales` salen
como **descripción** legible, no como clave. Los datos sensibles de
inclusión **no** aparecen aquí.

**Errores:** `404` si no existe.

---

### Marcar egresado como revisado

```
PATCH /egresados/:id/revisado
```

**Auth:** Solo `admin`

**Body** (tipado en línea, sin DTO):
```json
{ "revisado": true, "revisado_por": "<usuario admin>" }
```

Con `revisado: false` se limpian `fecha_revision` y `revisado_por`.

**Respuesta 200:**
```json
{ "mensaje": "Respuesta marcada como revisada." }
```

Con `revisado: false`: `{ "mensaje": "Revisión removida correctamente." }`. `404` si no existe.

---

### Eliminar egresado

```
DELETE /egresados/:id
```

**Auth:** Solo `admin`

**Respuesta 200:**
```json
{ "mensaje": "Egresado eliminado correctamente." }
```

> Borra explícitamente todas sus filas hijas (autorizaciones,
> certificaciones, habilidades, colaboraciones, datos de inclusión,
> trayectoria, notificaciones) y la foto del disco si existe. `404` si no existe.

---

### Egresados pendientes de revisión

```
GET /egresados/pendientes-revision
```

**Auth:** Solo `admin`

**Respuesta 200:** `total` es el conteo real (number); `egresados` trae
solo los **10** más recientes.

```json
{
  "total": 12,
  "egresados": [
    {
      "id_egresado": 1,
      "nombre_completo": "Juan Pérez",
      "fecha_registro": "2026-05-20T...",
      "nombre_carrera": "Ingeniería en Sistemas",
      "foto_url": "uploads/fotos/abc.jpg"
    }
  ]
}
```

---

### Directorio

```
GET /egresados/directorio?page=1&limit=24&busqueda=Juan&carrera=Sistemas&anio=2022&titulacion=Titulado
```

**Auth:** Cualquier usuario autenticado
**Query (todos opcionales):**

| Param | Tipo | Notas |
|---|---|---|
| `page` | number | Default 1 |
| `limit` | number | Default 24, tope 100 |
| `busqueda` | string | `LIKE` sobre `nombre_completo` |
| `carrera` | string | `nombre_carrera` exacto |
| `anio` | number | `anio_egreso` |
| `titulacion` | string | `estatus_titulacion` exacto |

**Respuesta 200:** paginado, ordenado por nombre. `total` es number.

```json
{
  "data": [
    {
      "id_egresado": 9,
      "nombre_completo": "Juan Pérez",
      "foto_url": null,
      "ciudad_residencia": "Durango, Durango, México",
      "ciudad_trabajo": "Durango, Durango, México",
      "empresa": "Empresa S.A.",
      "puesto_trabajo": "Jefe de Manufactura",
      "estatus_titulacion": "Titulado",
      "anio_egreso": 2015,
      "linkedin": null,
      "nombre_carrera": "Ingeniería Industrial",
      "genero": "Masculino",
      "nivel_ingles": "Intermedio (B1-B2)",
      "sector_trabajo": "Sector privado",
      "antiguedad_empleo": "De 1 a 3 años",
      "coincidencia_laboral": "Parcialmente",
      "certificaciones": ["Six Sigma"],
      "interes_colaborar": ["Conferencias"]
    }
  ],
  "total": 499
}
```

> `sector_trabajo` es el alias de `situacion_laboral.situacion`.

---

### Filtros del directorio

```
GET /egresados/directorio/filtros
```

**Auth:** Cualquier usuario autenticado

**Respuesta 200:** carreras y años que tienen al menos un egresado.

```json
{ "carreras": ["Arquitectura", "Ingeniería Civil"], "anios": [2026, 2025] }
```

---

### Estadísticas generales

```
GET /egresados/estadisticas?carrera=Sistemas&anio=2022&tiempo=Menos%20de%203%20meses&medio=LinkedIn
```

**Auth:** Cualquier usuario autenticado
**Query params opcionales:** `carrera`, `anio`, `tiempo` (rango de `tiempo_primer_empleo`), `medio` (valor de `medio_primer_empleo`)

**Respuesta 200:** Objeto con múltiples secciones. **Casi todos los números llegan como string.**

```typescript
interface Estadisticas {
  kpis: {
    total_egresados: string;
    autorizo_contacto: string;
    autorizo_eventos: string;
    satisfaccion_promedio: string;   // "3.71"
    titulados: string;
    en_tramite: string;
    no_titulados: string;
    empleados: string;
    desempleados: string;
  };
  situacionLaboral: { situacion: string; total: string }[];
  empleabilidadCarrera: { nombre_carrera: string; total: string; empleados: string }[];
  titulacionAnio: { anio_egreso: number; total: string; titulados: string; en_tramite: string; pct_titulados: string }[];
  titulacionCohorte: { anio_ingreso: number; total: string; titulados: string; en_tramite: string; no_titulados: string; pct_titulados: string }[];
  titulacionCohorteSemestre: { anio_ingreso: number; periodo_ingreso: string; total: string; titulados: string; en_tramite: string; no_titulados: string; pct_titulados: string }[];
  coberturaCohorte: { total: string; con_cohorte: string };
  nivelesIngles: { nivel: string; total: string }[];
  inglesCarrera: { nombre_carrera: string; nivel: string; total: string }[];
  satisfaccionCarrera: { nombre_carrera: string; promedio: string }[];
  topEmpresas: { empresa: string; total: string }[];
  evolucionGeneracion: { anio_egreso: number; total: string; pct_empleados: string; pct_titulados: string; satisfaccion_pct: string }[];
  sectorLaboral: { sector: string; total: string }[];
  participacionCarrera: { nombre_carrera: string; autorizo_contacto: string; autorizo_eventos: string; total: string }[];
  fueraMexico: { ciudad_trabajo: string; nombre_carrera: string; total: string }[];
  fueraDurango: { ciudad_trabajo: string; nombre_carrera: string; total: string }[];
  coincidenciaCarrera: { nombre_carrera: string; coincidencia: string; total: string; porcentaje: string }[];
  tiempoEmpleoCarrera: { nombre_carrera: string; total_egresados: string; anios_promedio_para_emplearse: string }[];
  tiempoEmpleoGeneral: { anios_promedio_general: string };
  distribucionTiempoEmpleo: { nombre_carrera: string; id_tiempo: number; rango: string; total: string }[];
  medioPrimerEmpleo: { id_medio: number; medio: string; orden: number; total: string }[];
  titulacionCarrera: { nombre_carrera: string; total: string; titulados: string; en_tramite: string; no_titulados: string; pct_titulados: string; pct_en_tramite: string; pct_no_titulados: string }[];
  posgradoPorTipo: { tipo_posgrado: string; total: number }[];   // number (sale de estudios posteriores)
  totalPosgrado: { total: number };
  titulacionCarreraAnio: { nombre_carrera: string; anio_egreso: number; total: string; titulados: string; en_tramite: string; no_titulados: string; pct_titulados: string }[];
}
```

---

### Estadísticas por género

```
GET /egresados/estadisticas/genero?carrera=Sistemas&anio=2022
```

**Auth:** Cualquier usuario autenticado
**Query params opcionales:** `carrera`, `anio`

**Respuesta 200:** 17 secciones. Números como string salvo donde se indica.

```typescript
interface EstadisticasGenero {
  kpisGenero: { genero: string; total: string; porcentaje: string }[];
  proporcionCarreraGenero: { nombre_carrera: string; genero: string; total: string; porcentaje: string }[];
  egresoAnioGenero: { anio_egreso: number; genero: string; total: string; porcentaje_en_anio: string }[];
  composicionCarreraGenero: { nombre_carrera: string; genero: string; total: string; porcentaje: string }[];
  empleabilidadGenero: { genero: string; total: string; empleados: string; desempleados: string; pct_empleados: string; satisfaccion_promedio: string }[];
  sectorLaboralGenero: { genero: string; sector: string; total: string; porcentaje: string }[];
  coincidenciaLaboralGenero: { genero: string; coincidencia: string; total: string; porcentaje: string }[];
  tiempoEmpleoGenero: { genero: string; tiempo_promedio_meses: string }[];
  geografiaGenero: { genero: string; total: string; en_durango: string; fuera_durango_mexico: string; en_extranjero: string; pct_fuera_durango: string }[];
  topCiudadesGenero: { genero: string; ciudad_trabajo: string; total: string }[];
  titulacionGenero: { genero: string; total: string; titulados: string; en_tramite: string; no_titulados: string; pct_titulados: string; pct_en_tramite: string; pct_no_titulados: string }[];
  titulacionAnioGenero: { anio_egreso: number; genero: string; total: string; titulados: string; pct_titulados: string }[];
  posgradoGenero: { genero: string; total: number }[];
  posgradoTipoGenero: { genero: string; tipo_posgrado: string; total: number; porcentaje: number }[];
  inglesGenero: { genero: string; nivel: string; total: string; porcentaje: string }[];
  satisfaccionGenero: { genero: string; promedio: string; total: string; muy_satisfecho: string; satisfecho: string; neutral: string; insatisfecho: string; muy_insatisfecho: string }[];
  habilidadesGenero: { genero: string; habilidad: string; total: string; porcentaje: string }[];
}
```

---

### Distribución geográfica

```
GET /egresados/distribucion-geografica?carrera=Sistemas&anio=2022
```

**Auth:** Cualquier usuario autenticado
**Query params opcionales:** `carrera`, `anio`

**Respuesta 200:**
```typescript
interface DistribucionGeografica {
  kpisGeo: {
    total_mapeados: string;
    con_ciudad_trabajo: string;
    en_extranjero: string;
    paises_distintos: string;
    ciudades_trabajo_distintas: string;
  };
  topCiudadesTrabajo: { ciudad_trabajo: string; total: string }[];
  extranjerosPorPais: { pais: string; total: string }[];
  extranjerosDetalle: { ciudad_trabajo: string; pais: string; total: string }[];
  movilidadPorAnio: { anio_egreso: number; total: string; fuera_durango: string; en_extranjero: string; pct_fuera_durango: string; pct_extranjero: string }[];
  movilidadPorCarrera: { nombre_carrera: string; total: string; fuera_durango: string; pct_fuera_durango: string }[];
}
```

---

### Trayectoria profesional

```
GET /egresados/trayectoria?carrera=Sistemas&anio=2022
```

**Auth:** Cualquier usuario autenticado
**Query params opcionales:** `carrera`, `anio`

**Respuesta 200:** estudios posteriores, emprendimientos, proyectos sociales y primer empleo.

```typescript
interface Trayectoria {
  kpis: {
    total_egresados: string;
    con_estudios_posteriores: string;
    con_emprendimiento: string;
    emprendimientos_activos: string;
    con_proyecto_social: string;
    con_certificaciones: string;
  };
  estudiosPorNivel: { nivel: string; total: string }[];
  estudiosPorEstado: { estado: string; total: string }[];
  topInstituciones: { institucion: string; total: string }[];
  estudiosPorCarrera: { nombre_carrera: string; total_egresados: string; con_estudios: string; pct: string }[];
  emprendimientoPorRango: { rango: string; total: string }[];
  topGiros: { giro: string; total: string }[];
  emprendimientoPorCarrera: { nombre_carrera: string; total_egresados: string; con_emprendimiento: string; pct: string }[];
  proyectosPorTipo: { tipo: string; total: string }[];
  proyectosPorCarrera: { nombre_carrera: string; total_egresados: string; con_proyecto: string; pct: string }[];
  topOrganizaciones: { organizacion: string; total: string }[];
  topEmpresasPrimerEmpleo: { empresa: string; total: string }[];
  topPuestosPrimerEmpleo: { puesto: string; total: string }[];
  carrerasDisponibles: string[];
  aniosDisponibles: number[];
}
```

---

### Comparativa entre carreras

```
GET /egresados/comparativas?carreras=Sistemas,Industrial,Civil
```

**Auth:** Cualquier usuario autenticado
**Query:** `carreras` = nombres separados por coma (**2–3** carreras; fuera de ese rango → `400`)

**Respuesta 200:**
```typescript
interface Comparativas {
  carreras: string[];
  resumen: { nombre_carrera: string; total: string; pct_empleados: string; pct_titulados: string; satisfaccion_promedio: string; pct_fuera_durango: string }[];
  empleo: { nombre_carrera: string; total: string; empleados: string; desempleados: string; pct_empleados: string }[];
  titulacion: { nombre_carrera: string; total: string; titulados: string; en_tramite: string; no_titulados: string; pct_titulados: string; pct_en_tramite: string; pct_no_titulados: string }[];
  sectorCarrera: { nombre_carrera: string; sector: string; total: string; porcentaje: string }[];
  ingles: { nombre_carrera: string; nivel: string; total: string; porcentaje: string }[];
  satisfaccion: { nombre_carrera: string; promedio: string; promedio_pct: string; total: string; muy_satisfecho: string; satisfecho: string; neutral: string; insatisfecho: string; muy_insatisfecho: string }[];
  migracion: { nombre_carrera: string; total: string; en_durango: string; fuera_durango_mexico: string; en_extranjero: string; pct_fuera_durango: string; pct_extranjero: string }[];
  tiempoPrimerEmpleo: { nombre_carrera: string; id_tiempo: number; rango: string; total: string; porcentaje: string }[];
  medioPrimerEmpleo: { nombre_carrera: string; id_medio: number; medio: string; orden: number; total: string; porcentaje: string }[];
}
```

---

### Vinculación — egresados por colaboración

```
GET /egresados/vinculacion/colaboracion?tipo=Conferencias&carrera=Sistemas&anio=2022
```

**Auth:** Cualquier usuario autenticado
**Query:** `tipo` (requerido, `descripcion` exacta de `/colaboraciones`), `carrera` y `anio` (opcionales)

**Respuesta 200:** Array de `{ id_egresado, nombre_completo, correo, telefono, nombre_carrera, genero, foto_url }`

---

### Vinculación — egresados por habilidad

```
GET /egresados/vinculacion/habilidad?tipo=Liderazgo&carrera=Sistemas&anio=2022
```

**Auth:** Cualquier usuario autenticado
**Query:** `tipo` (requerido, `habilidad` exacta de `/habilidades`), `carrera` y `anio` (opcionales)
Misma estructura de respuesta que por colaboración.

---

### Vinculación — totales de colaboraciones

```
GET /egresados/vinculacion/totales-colaboraciones?carrera=Sistemas&anio=2022
```

**Auth:** Cualquier usuario autenticado

**Respuesta 200:** una fila por colaboración del catálogo + una fila final `'Otro'`.
**Ojo:** las filas del catálogo traen `total` como **string**; la fila `'Otro'` lo trae como **number**.

```json
[
  { "descripcion": "Conferencias", "total": "159" },
  { "descripcion": "Otro", "total": 142 }
]
```

---

### Vinculación — totales de habilidades

```
GET /egresados/vinculacion/totales-habilidades?carrera=Sistemas&anio=2022
```

**Auth:** Cualquier usuario autenticado

**Respuesta 200:** igual que el anterior, con la clave `habilidad`:

```json
[
  { "habilidad": "Dominio del idioma inglés", "total": "162" },
  { "habilidad": "Otro", "total": 144 }
]
```

---

### Vinculación — colaboración "otro"

```
GET /egresados/vinculacion/colaboracion-otro?carrera=Sistemas&anio=2022
```

**Auth:** Cualquier usuario autenticado

**Respuesta 200:** Array de `{ id_egresado, nombre_completo, correo, telefono, nombre_carrera, genero, foto_url, descripcion_otro }`

---

### Vinculación — habilidad "otro"

```
GET /egresados/vinculacion/habilidad-otro?carrera=Sistemas&anio=2022
```

**Auth:** Cualquier usuario autenticado
Misma estructura que colaboración "otro".

---

### Vinculación — distribución de satisfacción

```
GET /egresados/vinculacion/distribucion-satisfaccion?carrera=Sistemas&anio=2022
```

**Auth:** Cualquier usuario autenticado

**Respuesta 200:** `{ nivel: number; total: string }[]` (niveles 1–5)

```json
[ { "nivel": 1, "total": "26" } ]
```

---

### Vinculación — egresados por autorización

```
GET /egresados/vinculacion/autorizacion?tipo=contacto&carrera=Sistemas&anio=2022
```

**Auth:** Cualquier usuario autenticado
**Query:** `tipo` = `estadisticas` | `contacto` | `eventos` (otro valor → `400`)

**Respuesta 200:** Array de `{ id_egresado, nombre_completo, correo, telefono, nombre_carrera, genero, foto_url }`

---

### Vinculación — carreras y años disponibles

```
GET /egresados/vinculacion/carreras
GET /egresados/vinculacion/anios
```

**Auth:** Cualquier usuario autenticado

**Respuesta 200:** carreras / años de egreso que tienen al menos un egresado.

```json
["Arquitectura", "Ingeniería Civil"]
```
```json
[2026, 2025, 2024]
```

---

### Exportar lista de egresados a PDF

```
GET /egresados/export/pdf?carrera=Sistemas&anio=2022&estatus_titulacion=Titulado,En%20trámite
```

**Auth:** Solo `admin`
**Query (DTO `ExportEgresadosDto`, todos opcionales):**

| Param | Tipo | Notas |
|---|---|---|
| `busqueda` | string | |
| `nombre` | string | |
| `empresa` | string | |
| `carrera` | string | |
| `anio` | string numérica | |
| `situacion_laboral` | string | |
| `estatus_titulacion` | lista separada por coma | Cada valor: `Titulado` \| `En trámite` \| `No titulado` |
| `autorizo_contacto` | `true` \| `1` | Cualquier otro valor = `false` |
| `autorizo_eventos` | `true` \| `1` | |
| `autorizo_estadisticas` | `true` \| `1` | |

Un query param que no esté en esta lista → `400`.

**Respuesta:** `application/pdf` — `egresados_<fecha>.pdf`

---

### Exportar lista de egresados a Excel

```
GET /egresados/export/excel?carrera=Sistemas&anio=2022
```

**Auth:** Solo `admin`
Mismos query params que PDF.

**Respuesta:** `.xlsx` — `egresados_<fecha>.xlsx`

---

### Exportar perfil individual a PDF

```
GET /egresados/:id/export/pdf
```

**Auth:** Solo `admin`

**Respuesta:** `application/pdf` — `perfil_egresado_<id>_<fecha>.pdf`

---

### Exports de reportes (PDF / Excel)

Todos son **solo `admin`** y responden un binario de descarga directa.
PDF → `application/pdf`; Excel → `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`.

| Endpoint | Query | Archivo |
|---|---|---|
| `GET /egresados/estadisticas/export/pdf` | `carrera`, `anio` | `estadisticas_<fecha>.pdf` |
| `GET /egresados/estadisticas/export/excel` | `carrera`, `anio` | `estadisticas_<fecha>.xlsx` |
| `GET /egresados/estadisticas/genero/export/pdf` | `carrera`, `anio` | `generos_<fecha>.pdf` |
| `GET /egresados/estadisticas/genero/export/excel` | `carrera`, `anio` | `generos_<fecha>.xlsx` |
| `GET /egresados/empleabilidad/export/pdf` | `carrera`, `anio`, `tiempo`, `medio` | `empleabilidad_<fecha>.pdf` |
| `GET /egresados/empleabilidad/export/excel` | `carrera`, `anio`, `tiempo`, `medio` | `empleabilidad_<fecha>.xlsx` |
| `GET /egresados/titulacion/export/pdf` | `carrera`, `anio` | `titulacion_<fecha>.pdf` |
| `GET /egresados/titulacion/export/excel` | `carrera`, `anio` | `titulacion_<fecha>.xlsx` |
| `GET /egresados/trayectoria/export/pdf` | `carrera`, `anio` | `trayectoria_<fecha>.pdf` |
| `GET /egresados/trayectoria/export/excel` | `carrera`, `anio` | `trayectoria_<fecha>.xlsx` |
| `GET /egresados/vinculacion/export/pdf` | `carrera`, `anio` | `vinculacion_<fecha>.pdf` |
| `GET /egresados/vinculacion/export/excel` | `carrera`, `anio` | `vinculacion_<fecha>.xlsx` |
| `GET /egresados/vinculacion/panel/export/pdf` | `seccion`, `valor`, `titulo`, `carrera`, `anio` | `vinculacion_panel_<fecha>.pdf` |
| `GET /egresados/vinculacion/panel/export/excel` | `seccion`, `valor`, `titulo`, `carrera`, `anio` | `vinculacion_panel_<fecha>.xlsx` |
| `GET /egresados/comparativas/export/pdf` | `carreras` (coma) | `comparativas_<fecha>.pdf` |
| `GET /egresados/comparativas/export/excel` | `carreras` (coma) | `comparativas_<fecha>.xlsx` |
| `GET /egresados/distribucion-geografica/export/pdf` | `carrera`, `anio` | `geografia_<fecha>.pdf` |
| `GET /egresados/distribucion-geografica/export/excel` | `carrera`, `anio` | `geografia_<fecha>.xlsx` |

Notas:
- `empleabilidad` y `titulacion` **no** tienen endpoint JSON propio: sus pantallas leen de `GET /egresados/estadisticas`.
- `vinculacion/panel` exporta la lista que se ve en un panel de vinculación: `seccion` = `colab` | `hab` | `auth`, `valor` = el tipo de colaboración / habilidad / autorización, `titulo` = encabezado del documento.

---

## Módulo: Inclusión

```
Controlador: @UseGuards(JwtAuthGuard, RolesGuard) + @Roles('admin') a nivel de clase
```

Datos personales **sensibles** (LFPDPPP). Reglas que aplica el servicio:

- **Todo el módulo es solo `admin`.**
- **Ningún endpoint acepta query params**: cada reporte tiene un corte fijo para que no se puedan combinar filtros y deducir casos individuales.
- Solo agregados, nunca nombres ni ids (salvo `consentimiento/:id`).
- Solo cuentan egresados con `consintio_datos_sensibles = 1`.
- **Umbral k = 3 aplicado en el SQL:** un conteo mayor que 0 y menor que 3 sale como **`null`**. Un 0 sale como 0.
- Respuestas con `Cache-Control: no-store` (excepto los exports).

Los reportes (1–5) vienen envueltos así:

```typescript
interface ReporteInclusion<T> {
  umbral: number;   // 3
  nota: string;     // explica la supresión de conteos
  datos: T;
}
```

Los conteos con umbral son `string | null`.

### Resumen

```
GET /inclusion/resumen
```

**Auth:** Solo `admin`

**Respuesta 200:**
```json
{
  "umbral": 3,
  "nota": "Los conteos mayores que 0 pero menores a 3 se muestran como null...",
  "datos": {
    "total_egresados": "499",
    "consintieron": "120",
    "no_consintieron": "379",
    "personas_con_discapacidad": "14",
    "se_consideran_indigenas": null,
    "hablan_lengua_indigena": null,
    "se_consideran_afromexicanos": "5",
    "nacidos_fuera_de_mexico": "9",
    "cobertura": {
      "anio_min": 2008,
      "anio_max": 2026,
      "decadas": [ { "etiqueta": "2008-2009", "desde": 2008, "hasta": 2009, "total": 8 } ]
    }
  }
}
```

`total_egresados`, `consintieron` y `no_consintieron` no llevan umbral.
`cobertura` usa números (`Number()`); sale de todos los egresados.

---

### Discapacidad por dominio

```
GET /inclusion/discapacidad-por-dominio
```

**Auth:** Solo `admin`

**Respuesta 200:** rejilla completa dominio × grado (todas las celdas aparecen).

```json
{
  "umbral": 3,
  "nota": "...",
  "datos": [
    {
      "dominio": "ver",
      "pregunta": "Ver, aun usando lentes",
      "grados": [ { "grado": "sin_dificultad", "descripcion": "No tengo dificultad", "total": "295" } ]
    }
  ]
}
```

---

### Identidad por pregunta

```
GET /inclusion/identidad-por-pregunta
```

**Auth:** Solo `admin`

**Respuesta 200:** rejilla pregunta × respuesta, más el desglose de lenguas.
`lengua_indigena` **no** lleva umbral y su `total` es **number**.

```json
{
  "umbral": 3,
  "nota": "...",
  "datos": [
    {
      "pregunta_clave": "indigena",
      "pregunta": "De acuerdo con su cultura, ¿se considera indígena?",
      "respuestas": [ { "clave": "si", "descripcion": "Sí", "total": "31" } ]
    }
  ],
  "lengua_indigena": [ { "lengua": "Otomí", "total": 2 } ]
}
```

---

### Por carrera

```
GET /inclusion/por-carrera
```

**Auth:** Solo `admin`

**Respuesta 200:** todas las carreras del catálogo. `consintieron` no lleva umbral.

```json
{
  "umbral": 3,
  "nota": "...",
  "datos": [
    {
      "carrera": "Arquitectura",
      "consintieron": "8",
      "personas_con_discapacidad": null,
      "se_consideran_indigenas": null,
      "se_consideran_afromexicanos": "0"
    }
  ]
}
```

---

### Por año de egreso

```
GET /inclusion/por-anio-egreso
```

**Auth:** Solo `admin`

**Respuesta 200:** todos los años con egresados (no solo los que consintieron).

```json
{
  "umbral": 3,
  "nota": "...",
  "datos": [
    {
      "anio_egreso": 2019,
      "consintieron": "11",
      "personas_con_discapacidad": "3",
      "se_consideran_indigenas": null,
      "se_consideran_afromexicanos": "0"
    }
  ]
}
```

---

### Consultar consentimiento de un egresado

```
GET /inclusion/consentimiento/:id
```

**Auth:** Solo `admin`
Devuelve solo el estado del consentimiento, nunca las respuestas.

**Respuesta 200:**
```json
{ "id_egresado": 42, "consintio": true, "fecha_consentimiento": "2026-09-04T07:09:37.000Z" }
```

`fecha_consentimiento` es `null` si no consintió. `404` si el egresado no existe.

---

### Retirar consentimiento (derechos ARCO)

```
DELETE /inclusion/consentimiento/:id
```

**Auth:** Solo `admin`
Borra las filas de `egresado_discapacidad` y `egresado_identidad` y pone el
consentimiento en 0, **sin** borrar al egresado. Queda auditado en el
historial (`retirar_consentimiento`).

**Respuesta 200:**
```json
{ "mensaje": "Datos de inclusión retirados.", "filas_eliminadas": 7 }
```

Si no había nada que retirar:
```json
{ "mensaje": "El egresado no tenía consentimiento vigente ni datos de inclusión que retirar.", "filas_eliminadas": 0 }
```

`404` si el egresado no existe.

---

### Exportar reporte de inclusión

```
GET /inclusion/export/pdf
GET /inclusion/export/excel
```

**Auth:** Solo `admin`
**Query:** ninguno

**Respuesta:** `inclusion_<fecha>.pdf` / `inclusion_<fecha>.xlsx` — descarga directa.

---

## Módulo: Duplicados

```
Controlador: @UseGuards(JwtAuthGuard, RolesGuard) + @Roles('admin') a nivel de clase
```

Detección y fusión de egresados registrados más de una vez.

- **Todo el módulo es solo `admin`.**
- El detector solo **propone** pares en `duplicados_candidatos`; nunca borra.
- La fusión es la única ruta del módulo que **borra** egresados, y solo entre registros que el detector ya conectó (par `pendiente` o `confirmado`, directo o transitivo).
- Estados de un candidato: `pendiente` | `confirmado` | `descartado`. Re-ejecutar el detector nunca pisa una decisión del admin.
- Aquí todos los agregados pasan por `Number()`: los conteos llegan como **number**.
- Respuestas con `Cache-Control: no-store`. Las acciones quedan en el historial.

### Ejecutar detección

```
POST /duplicados/detectar
```

**Auth:** Solo `admin`
**Body:** ninguno

Compara todos contra todos. Señales y puntos: número de control 50,
teléfono 30, nombre 25, nombre reordenado 25, usuario de correo 20,
carrera 10, años cercanos 10 (tope 100).

**Respuesta 200:**
```json
{
  "total_egresados": 499,
  "pares_evaluados": 124251,
  "candidatos_nuevos": 3,
  "candidatos_actualizados": 1,
  "candidatos_respetados": 5,
  "candidatos_eliminados": 0,
  "total_pendientes": 9
}
```

---

### Resumen

```
GET /duplicados/resumen
```

**Auth:** Solo `admin`

**Respuesta 200:**
```json
{
  "pendientes": 9,
  "confirmados": 0,
  "descartados": 4,
  "egresados_involucrados": 18,
  "ultima_deteccion": "2026-09-27T18:00:00.000Z"
}
```

`ultima_deteccion` es `null` si nunca se ha corrido el detector.

---

### Listar candidatos (agrupados en casos)

```
GET /duplicados?estado=pendiente&carrera=Sistemas&limit=50&offset=0
```

**Auth:** Solo `admin`
**Query (DTO `ListarDuplicadosDto`, todos opcionales):**

| Param | Tipo | Notas |
|---|---|---|
| `estado` | string | `pendiente` (default) \| `confirmado` \| `descartado` |
| `carrera` | string | `nombre_carrera` de cualquiera de los dos |
| `limit` | number | 1–200, default 50 |
| `offset` | number | ≥ 0, default 0 |

`limit`/`offset` se aplican sobre **grupos**, no sobre pares: un caso A~B~C
nunca queda partido entre páginas. `total` = número de grupos.

**Respuesta 200:**
```typescript
interface ListadoDuplicados {
  grupos: {
    ids: number[];
    score_max: number;
    candidatos: {
      id_candidato: number;
      id_egresado_a: number;
      id_egresado_b: number;
      score: number;
      senales: string[];          // ["Mismo número de control", "Misma carrera", ...]
      coincide_num_control: boolean;
      coincide_correo: boolean;
      coincide_telefono: boolean;
      coincide_nombre: boolean;
      coincide_carrera: boolean;
      similitud_nombre: number;
      diferencia_anios: number;
      estado: 'pendiente' | 'confirmado' | 'descartado';
      detectado_en: string;
      revisado_por: string | null;
      revisado_en: string | null;
      notas: string | null;
      egresado_a: EgresadoDuplicado;
      egresado_b: EgresadoDuplicado;
    }[];
    egresados: EgresadoDuplicado[];
  }[];
  total: number;
}

interface EgresadoDuplicado {
  id_egresado: number;
  nombre_completo: string;
  correo: string;
  telefono: string;
  numero_control: string;
  nombre_carrera: string;
  anio_ingreso: number | null;
  anio_egreso: number;
  fecha_registro: string;
  registro_completo: boolean;
  revisado: boolean;
}
```

---

### Descartar un par

```
PATCH /duplicados/:id/descartar
```

**Auth:** Solo `admin`
**Params:** `id` = `id_candidato`

**Body (opcional):**
```json
{ "notas": "Son hermanos, comparten teléfono." }
```

| Campo | Tipo | Requerido | Notas |
|---|---|---|---|
| `notas` | string | — | Máx. 500 |

**Respuesta 200:**
```json
{ "mensaje": "Par descartado: no se trata de un duplicado.", "id_candidato": 17 }
```

`404` si el candidato no existe. `409` si ya estaba descartado.

---

### Fusionar

```
POST /duplicados/fusionar
```

**Auth:** Solo `admin`

**Body:**
```json
{
  "id_egresado_conservado": 120,
  "ids_eliminados": [311],
  "notas": "Se conserva el registro con etapa 2 completa."
}
```

| Campo | Tipo | Requerido | Notas |
|---|---|---|---|
| `id_egresado_conservado` | number (int ≥ 1) | ✓ | El registro que sobrevive |
| `ids_eliminados` | number[] | ✓ | 1–10 ids; se fusionan en el conservado y después se **borran** |
| `notas` | string | — | Máx. 500 |

Todo el grupo va en una sola transacción. Los hijos (autorizaciones,
habilidades, trayectoria, datos de inclusión, etc.) se reasignan al
conservado; los campos vacíos del conservado se completan con los del
eliminado. En `autorizaciones` gana la respuesta **más restrictiva**. Cada
eliminado deja un registro en la bitácora con un snapshot completo.

**Respuesta 200:**
```json
{
  "mensaje": "Se fusionaron 1 registro(s) en el egresado 120.",
  "id_egresado_conservado": 120,
  "fusiones": [
    {
      "id_fusion": 5,
      "id_egresado_eliminado": 311,
      "id_candidato": 17,
      "hijos_reasignados": { "egresado_habilidades": 3, "certificaciones": 1 },
      "hijos_no_movidos": { "autorizaciones": 1 },
      "campos_completados": { "linkedin": "https://linkedin.com/in/juan" }
    }
  ]
}
```

**Errores `400`:** el conservado viene también en `ids_eliminados`; ids repetidos; algún id no existe; algún eliminado no está conectado con el conservado por pares del detector.
**`409`:** no se pudo borrar un eliminado (se revierte todo).

---

### Bitácora de fusiones

```
GET /duplicados/fusiones?limit=50&offset=0
```

**Auth:** Solo `admin`
**Query (DTO `ListarFusionesDto`):** `limit` (1–200, default 50), `offset` (≥ 0, default 0)

**Respuesta 200:**
```typescript
interface ListadoFusiones {
  fusiones: Fusion[];
  total: number;
}

interface Fusion {
  id_fusion: number;
  id_egresado_conservado: number | null;
  nombre_conservado: string | null;
  id_egresado_eliminado: number;
  nombre_eliminado: string;
  correo_eliminado: string;
  numero_control_eliminado: string;
  hijos_reasignados: Record<string, number>;   // por tabla hija
  campos_completados: Record<string, unknown>;
  id_candidato: number | null;
  fusionado_por: string | null;
  fusionado_en: string;
  notas: string | null;
}
```

---

### Detalle de una fusión

```
GET /duplicados/fusiones/:id
```

**Auth:** Solo `admin`

**Respuesta 200:** `Fusion` + `snapshot` (JSON con el egresado eliminado y todas sus filas hijas tal como estaban antes de borrarlo).

`404` si no existe.

---

## Módulo: Empresas

```
Controlador: @UseGuards(JwtAuthGuard, RolesGuard) + @Roles('admin') a nivel de clase
Prefijo: /admin/empresas
```

Normalización de nombres de empresa (migración `013_empresas.sql`).

- **Todo el módulo es solo `admin`.**
- Los textos `egresados.empresa` y `egresados.primer_empleo_empresa` **nunca se modifican**. La fusión solo llena las FK `empresa_id` y `primer_empleo_empresa_id`, que apuntan al catálogo `empresas`.
- El detector solo **propone** variantes en `empresas_candidatos`; nunca liga egresados.
- Estados de un candidato: `pendiente` | `fusionado` | `descartado`. Re-ejecutar el detector nunca pisa una decisión del admin.
- La clave de agrupación (`nombre_clave`: minúsculas, sin puntos ni comas, sin sufijo societario) se calcula con `claveEmpresaSql()` de `src/common/constants/normalizacion-empresa.ts`, la misma expresión de la columna generada `empresas.nombre_clave`. Las claves se comparan sin distinguir acentos ni mayúsculas; las variantes, de forma exacta (`utf8mb4_0900_as_cs`).
- Los reportes, el dashboard y los exports **todavía agrupan por el texto crudo**: aún no leen estas FK.
- Aquí todos los agregados pasan por `Number()`: los conteos llegan como **number**.
- Respuestas con `Cache-Control: no-store`. Las acciones quedan en el historial (sección `empresas`).

### Ejecutar detección

```
POST /admin/empresas/detectar
```

**Auth:** Solo `admin`
**Body:** ninguno

Junta los textos de `empresa` y `primer_empleo_empresa`, los agrupa por
clave normalizada y guarda una fila por variante de cada grupo que tenga
más de un texto distinto. Un grupo puede cruzar columnas. Una variante que
ya existía solo actualiza sus contadores. Borra los `pendiente` que ya no
aparecen en los datos.

`nombre_sugerido` = la variante con más ocurrencias totales del grupo; si
empatan, la más corta; si siguen empatadas, la primera alfabéticamente.

**Respuesta 200:**
```json
{
  "grupos": 12,
  "grupos_empresa": 11,
  "grupos_primer_empleo": 1,
  "variantes": 29,
  "variantes_nuevas": 29,
  "variantes_actualizadas": 0,
  "variantes_respetadas": 0,
  "variantes_eliminadas": 0,
  "total_pendientes": 29
}
```

`grupos` cuenta las dos columnas juntas; `grupos_empresa` y
`grupos_primer_empleo` cuentan los grupos con más de un texto dentro de
cada columna por separado. `variantes_respetadas` = variantes ya revisadas
(fusionadas o descartadas) que conservaron su estado.

---

### Listar candidatos (agrupados por clave)

```
GET /admin/empresas/candidatos?estado=pendiente
```

**Auth:** Solo `admin`
**Query (DTO `ListarCandidatosEmpresaDto`):** `estado` = `pendiente` (default) | `fusionado` | `descartado`

Solo aparecen las variantes en el estado pedido: un grupo con dos
fusionadas y una pendiente muestra una variante en `?estado=pendiente`.
Grupos ordenados por `total_ocurrencias` descendente.

**Respuesta 200:**
```typescript
interface ListadoCandidatosEmpresa {
  grupos: {
    nombre_clave: string;
    nombre_sugerido: string;
    total_ocurrencias: number;
    variantes: {
      id_empresa_candidato: number;
      nombre_variante: string;          // texto crudo, con sus espacios
      ocurrencias_empresa: number;
      ocurrencias_primer_empleo: number;
      estado: 'pendiente' | 'fusionado' | 'descartado';
      empresa_id: number | null;        // canónico al que se fusionó
      empresa_nombre: string | null;
      detectado_en: string;
      revisado_por: string | null;
      revisado_en: string | null;
    }[];
  }[];
  total: number;                        // número de grupos
}
```

---

### Fusionar variantes en un nombre canónico

```
POST /admin/empresas/fusionar
```

**Auth:** Solo `admin`

**Body:**
```json
{
  "nombre_canonico": "Comisión Federal de Electricidad",
  "variantes": ["CFE", "Comisión Federal de Electricidad", "COMISIÓN FEDERAL DE ELECTRICIDAD"]
}
```

| Campo | Tipo | Requerido | Notas |
|---|---|---|---|
| `nombre_canonico` | string | ✓ | Máx. 255. Si ya hay una empresa con la misma clave se reutiliza (y conserva su `nombre`); si no, se crea |
| `variantes` | string[] | ✓ | 1–50. Textos crudos **exactos**, tal como los devuelve `/candidatos` (mayúsculas, acentos y espacios incluidos) |

Todo va en una transacción. Las variantes **no** tienen que compartir
`nombre_clave`: es intencional, para fusionar a mano lo que ninguna regla
de texto agrupa (siglas, prefijos, errores de dedo). Una variante sin fila
de candidato se inserta ya como `fusionado`. Volver a fusionar una variante
la re-apunta al nuevo canónico.

**Respuesta 200:**
```json
{
  "mensaje": "Se fusionaron 3 variante(s) en \"Comisión Federal de Electricidad\".",
  "empresa": { "id_empresa": 2, "nombre": "Comisión Federal de Electricidad", "creada": true },
  "egresados_ligados": { "empresa": 10, "primer_empleo": 21 },
  "candidatos_actualizados": 2,
  "candidatos_insertados": 1
}
```

**Errores `400`:** alguna variante no la tiene ningún egresado ni es candidato; `nombre_canonico` queda vacío al normalizarlo.

---

### Descartar una variante

```
POST /admin/empresas/candidatos/:id/descartar
```

**Auth:** Solo `admin`
**Params:** `id` = `id_empresa_candidato`
**Body:** ninguno

La variante deja de aparecer como pendiente y el detector no la reactiva.

**Respuesta 200:**
```json
{ "mensaje": "Variante descartada.", "id_empresa_candidato": 16 }
```

`404` si el candidato no existe. `409` si ya estaba descartado o ya fue fusionado.

---

### Catálogo canónico

```
GET /admin/empresas?busqueda=deere
```

**Auth:** Solo `admin`
**Query (DTO `ListarEmpresasDto`):** `busqueda` (opcional, `LIKE` sobre `nombre`)

**Respuesta 200:** ordenado por nombre.
```json
{
  "empresas": [
    {
      "id_empresa": 1,
      "nombre": "FEMSA",
      "nombre_clave": "femsa",
      "activo": true,
      "creado_en": "2026-10-05T17:39:07.000Z",
      "egresados_empresa": 10,
      "egresados_primer_empleo": 12
    }
  ],
  "total": 1
}
```

---

### Eliminar una empresa del catálogo

```
DELETE /admin/empresas/:id_empresa
```

**Auth:** Solo `admin`
Solo si no tiene egresados ligados en ninguna de las dos columnas. No borra
en cascada.

**Respuesta 200:**
```json
{ "mensaje": "Empresa eliminada del catálogo.", "id_empresa": 3 }
```

`404` si no existe. `409` si tiene egresados ligados (el mensaje dice
cuántos por cada columna). Los candidatos que apuntaban a ella quedan con
`empresa_id = null`.

---

## Módulo: Dashboard

### Resumen general

```
GET /dashboard/resumen
```

**Auth:** Cualquier usuario autenticado

**Respuesta 200:** Los `kpis` y `periodo` llegan como **number**; los de `graficas` y `resumenCarrera`, como **string**.

```typescript
interface DashboardResumen {
  kpis: {
    total_egresados: number;
    pendientes_revision: number;
    tasa_empleo: number;
    satisfaccion_promedio: number;
    pct_titulados: number;
    total_titulados: number;
    total_respondidas: number;
    pct_cobertura: number;
  };
  graficas: {
    porCarrera: { nombre_carrera: string; total: string }[];
    situacionLaboral: { situacion: string; total: string; porcentaje: string }[];
    respuestasPorMes: { mes: string; mes_label: string; total: string }[];
    generosPorAnio: { anio_egreso: number; genero: string; total: string }[];
  };
  actividad: {
    ultimasRespuestas: { id_egresado: number; nombre_completo: string; fecha_registro: string; foto_url: string | null; revisado: 0 | 1; nombre_carrera: string; genero: string }[];
    egresadosRecientes: { id_egresado: number; nombre_completo: string; fecha_registro: string; foto_url: string | null; nombre_carrera: string; genero: string }[];
    notificaciones: Notificacion[];
    totalNotificacionesSinLeer: number;
  };
  periodo: {
    respuestas_este_mes: number;
    respuestas_mes_anterior: number;
    diferencia: number;
    tendencia: string;               // p. ej. "up"
  };
  pendientesDetalle: { id_egresado: number; nombre_completo: string; fecha_registro: string; foto_url: string | null; nombre_carrera: string }[];
  topDestacados: {
    carrera_top_empleo: { nombre_carrera: string; pct_empleados: string; total_egresados: number; minimo_aplicado: number };
    ciudad_top_trabajo: { ciudad_trabajo: string; total: string };
    empresa_top: { empresa: string; total: string };
    anio_top_titulacion: { anio_egreso: number; pct_titulados: string; total_egresados: number; minimo_aplicado: number };
  };
  resumenCarrera: { nombre_carrera: string; total: string; pct_empleados: string; pct_titulados: string; satisfaccion_promedio: string }[];
}
```

---

## Módulo: Notificaciones

Controlador con `@UseGuards(JwtAuthGuard, RolesGuard)` y sin `@Roles`: todo
es para cualquier usuario autenticado. Hay un cron (domingos 2:00 AM) que
hace limpieza automática.

### Listar notificaciones

```
GET /notificaciones?tipo=contacto
```

**Auth:** Cualquier usuario autenticado
**Query opcional:** `tipo` — filtra por tipo de notificación

**Respuesta 200:**
```typescript
interface Notificacion {
  id_notificacion: number;
  tipo: string;           // 'contacto' | 'eventos' | 'nueva_encuesta' | 'nueva_encuesta_ubicacion'
  titulo: string;
  descripcion: string;
  leida: boolean;         // boolean real (repositorio TypeORM)
  fecha_creacion: string;
  id_egresado: number | null;
}
```

---

### Notificaciones no leídas

```
GET /notificaciones/no-leidas
```

**Auth:** Cualquier usuario autenticado
**Respuesta 200:** Array de `Notificacion` donde `leida = false`

---

### Conteo de no leídas

```
GET /notificaciones/count
```

**Auth:** Cualquier usuario autenticado

**Respuesta 200:**
```json
{ "total": 5 }
```

---

### Marcar todas como leídas

```
PATCH /notificaciones/marcar-todas
```

**Auth:** Cualquier usuario autenticado

**Respuesta 200:**
```json
{ "mensaje": "Todas las notificaciones marcadas como leídas." }
```

---

### Marcar una como leída

```
PATCH /notificaciones/:id/leer
```

**Auth:** Cualquier usuario autenticado

**Respuesta 200:**
```json
{ "mensaje": "Notificación marcada como leída." }
```

---

### Eliminar todas las notificaciones

```
DELETE /notificaciones/todas
```

**Auth:** Cualquier usuario autenticado

**Respuesta 200:**
```json
{ "mensaje": "Todas las notificaciones han sido eliminadas.", "eliminadas": 23 }
```

---

### Eliminar notificaciones leídas

```
DELETE /notificaciones/leidas
```

**Auth:** Cualquier usuario autenticado

**Respuesta 200:**
```json
{ "mensaje": "Notificaciones leídas eliminadas.", "eliminadas": 10 }
```

---

### Eliminar una notificación

```
DELETE /notificaciones/:id
```

**Auth:** Cualquier usuario autenticado

**Respuesta 200:**
```json
{ "mensaje": "Notificación eliminada." }
```

---

## Módulo: Correo

### Envío masivo de correos

```
POST /correo/enviar
```

**Auth:** Solo `admin`
**Rate limit:** 2 envíos por minuto por IP

**Body (DTO `EnviarCorreoDto`):**
```json
{
  "destinatarios": ["a@example.com", "b@example.com"],
  "cc": [],
  "bcc": [],
  "asunto": "Invitación a evento",
  "mensaje": "Estimado egresado...",
  "esHtml": false,
  "adjuntos": [
    { "filename": "reporte.pdf", "content": "<base64>", "contentType": "application/pdf" }
  ]
}
```

| Campo | Tipo | Requerido | Notas |
|---|---|---|---|
| `destinatarios` | string[] (email) | ✓ | Mínimo 1 |
| `cc` | string[] (email) | — | |
| `bcc` | string[] (email) | — | |
| `asunto` | string | ✓ | |
| `mensaje` | string | ✓ | |
| `esHtml` | boolean | — | |
| `adjuntos` | `{ filename, content, contentType? }[]` | — | `content` en **base64**. El body admite hasta 10 MB |

**Respuesta 200:**
```json
{
  "ok": true,
  "enviados": 2,
  "mensaje": "Correo enviado a 2 destinatario(s)"
}
```

---

## Módulo: Usuarios

No hay guard a nivel de clase: cada método declara el suyo.

### Listar usuarios

```
GET /usuarios
```

**Auth:** Solo `admin`

**Respuesta 200:** Array de usuarios sin el campo `contrasena`:
```typescript
interface Usuario {
  id_usuario: number;
  usuario: string;
  nombre_completo: string;
  rol: 'admin' | 'invitado';
  estado: 'activo' | 'inactivo';
  ultimo_acceso: string | null;
  fecha_creacion: string;
}
```

---

### Obtener usuario por ID

```
GET /usuarios/:id
```

**Auth:** `admin` puede consultar cualquier id. Cualquier otro rol solo su
propio id (el `sub` del token); otro id → `403`.
**Respuesta 200:** Objeto `Usuario` (sin `contrasena`). Si no existe, `200` con cuerpo vacío.

> `contrasena` nunca sale de la API: la columna es `select: false` en la
> entidad y solo el login la pide explícitamente (`addSelect`).

---

### Crear usuario invitado

```
POST /usuarios/invitado
```

**Auth:** Solo `admin`

**Body:**
```json
{ "nombre_completo": "María García" }
```

El `usuario` se genera como `<rol>_<iniciales><año>`.

**Respuesta 201:**
```json
{
  "usuario": { "...": "Usuario sin contrasena" },
  "contrasena_temporal": "Kp3mQ9xZa2"
}
```

> `contrasena_temporal` (10 caracteres) es la única vez que se muestra. Mostrarla al admin para que la entregue al usuario.

**Errores:** `400` si falta `nombre_completo` o ya existe un usuario con ese nombre.

---

### Crear usuario admin

```
POST /usuarios/admin
```

**Auth:** Solo `admin`
Misma estructura que crear invitado.

---

### Cambiar estado de usuario

```
PUT /usuarios/:id/estado
```

**Auth:** Solo `admin`

**Body:**
```json
{ "estado": "inactivo" }
```

**Respuesta 200:**
```json
{ "message": "Usuario inactivo correctamente" }
```

**Errores:** `404` si no existe; `400` si se intenta desactivar al último admin activo.

---

### Eliminar usuario

```
DELETE /usuarios/:id
```

**Auth:** Solo `admin`

**Respuesta 200:**
```json
{ "message": "Usuario eliminado correctamente" }
```

**Errores:** `404` si no existe; `400` si es uno mismo o el último admin.

---

### Historial de actividad

```
GET /usuarios/historial?limite=50
```

**Auth:** Solo `admin`
**Query opcional:** `limite` (default: 50)

**Respuesta 200:** ordenado por `fecha_accion DESC`.
```typescript
interface HistorialActividad {
  id_historial: number;
  accion: string;
  descripcion: string;
  seccion: string;
  fecha_accion: string;
  usuario: Usuario;  // sin contrasena (select: false)
}
```

---

### Historial de un usuario específico

```
GET /usuarios/historial/:id
```

**Auth:** Solo `admin`
**Respuesta 200:** Array de `HistorialActividad` del usuario indicado, **sin** el objeto `usuario` (no carga la relación).

---

### Registrar una acción en el historial

```
POST /usuarios/historial
```

**Auth:** Cualquier usuario autenticado (`JwtAuthGuard` + `RolesGuard`, sin `@Roles`)
La acción se registra a nombre de `req.user.id_usuario`.

**Body** (tipado en línea, sin DTO):
```json
{ "accion": "exportar_pdf", "descripcion": "Exportó el reporte de estadísticas", "seccion": "estadisticas" }
```

**Respuesta 201:**
```json
{ "ok": true }
```

---

## Catálogos

Se usan para poblar los `<select>` del formulario de registro y los filtros
del panel.

### Catálogos públicos (sin token)

| Endpoint | Respuesta |
|---|---|
| `GET /carreras` | `{ id_carrera, nombre_carrera }[]` |
| `GET /generos` | `{ id_genero, genero }[]` |
| `GET /habilidades` | `{ id_habilidad, habilidad }[]` |
| `GET /situacion-laboral` | `{ id_situacion, situacion }[]` |
| `GET /titulacion` | `{ id_titulacion, estatus }[]` |
| `GET /antiguedad` | `{ id_antiguedad, rango }[]` |
| `GET /niveles-ingles` | `{ id_nivel, nivel }[]` |
| `GET /colaboraciones` | `{ id_colaboracion, descripcion }[]` |
| `GET /coincidencia` | `{ id_coincidencia, nivel }[]` |
| `GET /satisfaccion-formacion` | `{ id_satisfaccion, nivel: number }[]` |
| `GET /discapacidad-dominios` | `{ id_dominio, clave, pregunta, orden }[]` |
| `GET /grados-dificultad` | `{ id_grado, clave, descripcion, orden }[]` |
| `GET /respuestas-autoadscripcion` | `{ id_respuesta, clave, descripcion, orden }[]` |
| `GET /niveles-estudio` | `{ id_nivel_estudio, clave, descripcion, orden }[]` |
| `GET /estados-estudio` | `{ id_estado_estudio, clave, descripcion, orden }[]` |
| `GET /tipos-proyecto-social` | `{ id_tipo_proyecto, clave, descripcion, orden }[]` |
| `GET /rangos-empleados` | `{ id_rango_empleados, clave, descripcion, orden }[]` |

Los siete catálogos con `clave` se devuelven ordenados por `orden`. La etapa
1 los recibe por **`clave`**. `grados-dificultad` omite a propósito la
columna interna `cuenta_discapacidad`.

> Las rutas son `/antiguedad` y `/coincidencia` (las carpetas se llaman
> `antiguedad-empleo` y `coincidencia-laboral`, pero el `@Controller` no).

### Tablas de relación (solo `admin`)

Llevan `@Roles('admin')` a nivel de clase: exponen datos por egresado.

| Endpoint | Respuesta |
|---|---|
| `GET /autorizaciones` | `{ id_autorizacion, id_egresado, autorizo_estadisticas: boolean, autorizo_contacto: boolean, autorizo_eventos: boolean }[]` |
| `GET /certificaciones` | `{ id_certificacion, id_egresado, nombre_certificacion }[]` |
| `GET /egresado-habilidades` | `{ id, id_egresado, id_habilidad }[]` |
| `GET /egresado-colaboraciones` | `{ id, id_egresado, id_colaboracion }[]` |
| `GET /habilidades-otro` | `{ id_otro, id_egresado, descripcion }[]` |
| `GET /colaboracion-otro` | `{ id_otro, id_egresado, descripcion }[]` |

---

## Fotos de perfil

Las fotos se sirven como archivos estáticos:

```
GET http://localhost:3000/uploads/fotos/<nombre-archivo>
```

El campo `foto_url` en la respuesta ya contiene la ruta relativa lista para concatenar:

```typescript
const fotoUrl = `http://localhost:3000/${egresado.foto_url}`;
// → http://localhost:3000/uploads/fotos/1716500000000-123456.jpg
```

Si `foto_url` es `null`, el egresado no subió foto.

---

## Resumen de autorización por módulo

| Endpoint | Público | Invitado | Admin |
|---|---|---|---|
| `GET /` | ✓ | ✓ | ✓ |
| `POST /usuarios/login` | ✓ | ✓ | ✓ |
| `POST /egresados/etapa1` | ✓ | ✓ | ✓ |
| `PATCH /egresados/etapa2/:id` | ✓ | ✓ | ✓ |
| `GET /egresados/buscar` | ✓ | ✓ | ✓ |
| Catálogos públicos (17) | ✓ | ✓ | ✓ |
| `GET /egresados` | — | ✓ | ✓ |
| `GET /egresados/detalles` | — | ✓ | ✓ |
| `GET /egresados/:id/perfil` | — | ✓ | ✓ |
| `GET /egresados/estadisticas` | — | ✓ | ✓ |
| `GET /egresados/estadisticas/genero` | — | ✓ | ✓ |
| `GET /egresados/distribucion-geografica` | — | ✓ | ✓ |
| `GET /egresados/trayectoria` | — | ✓ | ✓ |
| `GET /egresados/comparativas` | — | ✓ | ✓ |
| `GET /egresados/directorio` | — | ✓ | ✓ |
| `GET /egresados/directorio/filtros` | — | ✓ | ✓ |
| `GET /egresados/vinculacion/*` (10 rutas JSON) | — | ✓ | ✓ |
| `GET /dashboard/resumen` | — | ✓ | ✓ |
| `GET /notificaciones/*` | — | ✓ | ✓ |
| `PATCH /notificaciones/*` | — | ✓ | ✓ |
| `DELETE /notificaciones/*` | — | ✓ | ✓ |
| `GET /usuarios/:id` | — | solo su id | ✓ |
| `POST /usuarios/historial` | — | ✓ | ✓ |
| `PATCH /egresados/:id/revisado` | — | — | ✓ |
| `DELETE /egresados/:id` | — | — | ✓ |
| `GET /egresados/pendientes-revision` | — | — | ✓ |
| `GET /egresados/export/pdf` y `/export/excel` | — | — | ✓ |
| `GET /egresados/:id/export/pdf` | — | — | ✓ |
| `GET /egresados/*/export/*` (18 exports de reportes) | — | — | ✓ |
| `GET /inclusion/*` (resumen, reportes, consentimiento, exports) | — | — | ✓ |
| `DELETE /inclusion/consentimiento/:id` | — | — | ✓ |
| `POST /duplicados/detectar` | — | — | ✓ |
| `GET /duplicados`, `/duplicados/resumen` | — | — | ✓ |
| `GET /duplicados/fusiones`, `/duplicados/fusiones/:id` | — | — | ✓ |
| `PATCH /duplicados/:id/descartar` | — | — | ✓ |
| `POST /duplicados/fusionar` | — | — | ✓ |
| `POST /admin/empresas/detectar` | — | — | ✓ |
| `GET /admin/empresas`, `/admin/empresas/candidatos` | — | — | ✓ |
| `POST /admin/empresas/fusionar` | — | — | ✓ |
| `POST /admin/empresas/candidatos/:id/descartar` | — | — | ✓ |
| `DELETE /admin/empresas/:id_empresa` | — | — | ✓ |
| `GET /usuarios` | — | — | ✓ |
| `GET /usuarios/historial`, `/usuarios/historial/:id` | — | — | ✓ |
| `POST /usuarios/invitado` | — | — | ✓ |
| `POST /usuarios/admin` | — | — | ✓ |
| `PUT /usuarios/:id/estado` | — | — | ✓ |
| `DELETE /usuarios/:id` | — | — | ✓ |
| `POST /correo/enviar` | — | — | ✓ |
| Tablas de relación (6: `/autorizaciones`, `/certificaciones`, `/egresado-habilidades`, `/egresado-colaboraciones`, `/habilidades-otro`, `/colaboracion-otro`) | — | — | ✓ |
