# API Reference — Egresados ITD

Backend NestJS. Base URL de desarrollo: `http://localhost:3000`

---

## Autenticación

El sistema usa **JWT Bearer Token**.

### Obtener token

```
POST /usuarios/login
```

**Body:**
```json
{ "usuario": "admin_rm2026", "contrasena": "abc123" }
```

**Respuesta 200:**
```json
{
  "mensaje": "Login exitoso",
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "usuario": {
    "id_usuario": 1,
    "usuario": "admin_rm2026",
    "nombre_completo": "Ricardo Martínez",
    "rol": "admin",
    "estado": "activo",
    "ultimo_acceso": "2026-05-24T10:00:00.000Z",
    "fecha_creacion": "2026-01-01T00:00:00.000Z"
  }
}
```

**Rate limit:** 5 intentos por minuto por IP. Al superarlo devuelve `429 Too Many Requests`.

### Usar el token en Angular

Enviar el header en cada petición protegida:

```
Authorization: Bearer <access_token>
```

**Interceptor recomendado:**
```typescript
// auth.interceptor.ts
intercept(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
  const token = localStorage.getItem('access_token');
  if (token) {
    req = req.clone({ setHeaders: { Authorization: `Bearer ${token}` } });
  }
  return next.handle(req);
}
```

### Roles y acceso

| Rol | Descripción |
|---|---|
| `admin` | Acceso completo a todos los endpoints |
| `invitado` | Lectura de datos (estadísticas, directorio, dashboard) |

### Endpoints públicos (sin token)

Los siguientes endpoints **no requieren token**:

- `POST /usuarios/login`
- `POST /egresados/etapa1`
- `PATCH /egresados/etapa2/:id`
- `GET /egresados/buscar`
- Todos los endpoints de catálogo (`GET /carreras`, `GET /generos`, etc.)

### Errores de autenticación

| Código | Significado |
|---|---|
| `401 Unauthorized` | Token ausente, inválido o expirado |
| `403 Forbidden` | Token válido pero el rol no tiene permiso |
| `429 Too Many Requests` | Rate limit superado |

---

## Módulo: Egresados

### Formulario público — Registro etapa 1

```
POST /egresados/etapa1
```

**Auth:** Público  
**Content-Type:** `multipart/form-data`

El campo `data` lleva el JSON del egresado como string, y `foto` es el archivo de imagen (opcional).

```
data: '{"nombre_completo":"Juan Pérez",...}'   ← string JSON
foto: <archivo>                                  ← opcional, max 2MB, jpg/png/webp
```

**Campos del JSON en `data`:**

| Campo | Tipo | Requerido | Notas |
|---|---|---|---|
| `nombre_completo` | string | ✓ | |
| `genero` | string | ✓ | Valor del catálogo `/generos` |
| `correo` | string (email) | ✓ | |
| `telefono` | string | ✓ | |
| `ciudad_residencia` | string | ✓ | |
| `carrera` | string | ✓ | Valor del catálogo `/carreras` |
| `anio_egreso` | number | ✓ | 1990–2026 |
| `estatus_titulacion` | string | ✓ | Valor del catálogo `/titulacion` |
| `certificacion_vigente` | string | ✓ | Valor del catálogo `/certificaciones-vigentes` |
| `nivel_ingles` | string | ✓ | Valor del catálogo `/niveles-ingles` |
| `situacion_laboral` | string | ✓ | Valor del catálogo `/situacion-laboral` |
| `empresa` | string | — | Opcional |
| `antiguedad_empleo` | string | — | Valor del catálogo `/antiguedad-empleo` |
| `ciudad_trabajo` | string | — | Opcional |
| `satisfaccion_formacion` | number | ✓ | 1–5 |
| `autorizaciones.estadisticas` | boolean | ✓ | |
| `autorizaciones.contacto` | boolean | ✓ | |
| `autorizaciones.eventos` | boolean | ✓ | |

**Respuesta 201:**
```json
{ "id_egresado": 42, "mensaje": "Etapa 1 guardada correctamente." }
```

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
  "puesto_trabajo": "Desarrollador Backend",
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
| `correo` | string (email) | ✓ | |
| `nombre_completo` | string | ✓ | |
| `numero_control` | string | ✓ | |
| `linkedin` | string | — | URL opcional |
| `puesto_trabajo` | string | — | |
| `coincidencia_laboral` | string | ✓ | Valor del catálogo `/coincidencia-laboral` |
| `certificaciones` | string | — | Nombre de una certificación |
| `habilidades` | string[] | ✓ | Valores del catálogo `/habilidades` |
| `habilidad_otro` | string | — | |
| `colaboraciones` | string[] | ✓ | Valores del catálogo `/colaboraciones` |
| `colaboracion_otro` | string | — | |

**Respuesta 200:**
```json
{ "mensaje": "Etapa 2 completada. Registro finalizado." }
```

---

### Buscar egresado por correo

```
GET /egresados/buscar?correo=juan@example.com
```

**Auth:** Público  
**Uso:** Verificar si un correo ya está registrado antes de mostrar el formulario.

**Respuesta 200:**
```json
{ "id_egresado": 42 }
```

Devuelve `null` si no existe.

---

### Listar todos los egresados

```
GET /egresados
```

**Auth:** Cualquier usuario autenticado

**Respuesta 200:** Array de objetos `Egresado` (datos crudos, sin joins).

---

### Listar egresados con detalles

```
GET /egresados/detalles
```

**Auth:** Cualquier usuario autenticado

**Respuesta 200:** Array con joins a todas las tablas de catálogo. Cada objeto incluye:

```typescript
interface EgresadoDetalle {
  id_egresado: number;
  nombre_completo: string;
  correo: string;
  telefono: string;
  ciudad_residencia: string;
  anio_egreso: number;
  empresa: string;
  ciudad_trabajo: string;
  fecha_registro: string;
  numero_control: string;
  linkedin: string;
  puesto_trabajo: string;
  estatus_titulacion: string;
  satisfaccion_formacion: number;
  foto_url: string | null;
  revisado: boolean;
  fecha_revision: string | null;
  revisado_por: string | null;
  genero: string;
  nombre_carrera: string;
  nivel_ingles: string;
  antiguedad_empleo: string;
  coincidencia_laboral: string;
  situacion_laboral: string;
  certificacion_vigente: string;
  autorizo_estadisticas: boolean;
  autorizo_contacto: boolean;
  autorizo_eventos: boolean;
}
```

---

### Perfil completo de un egresado

```
GET /egresados/:id/perfil
```

**Auth:** Cualquier usuario autenticado

**Respuesta 200:** `EgresadoDetalle` + arreglos de relaciones:

```typescript
interface EgresadoPerfil extends EgresadoDetalle {
  certificaciones: string[];
  habilidades: string[];
  habilidades_otro: string[];
  colaboraciones: string[];
  colaboraciones_otro: string[];
}
```

---

### Marcar egresado como revisado

```
PATCH /egresados/:id/revisado
```

**Auth:** Solo `admin`

**Body:**
```json
{ "revisado": true, "revisado_por": "admin_rm2026" }
```

**Respuesta 200:**
```json
{ "mensaje": "Respuesta marcada como revisada." }
```

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

> También elimina la foto del disco si existe.

---

### Egresados pendientes de revisión

```
GET /egresados/pendientes-revision
```

**Auth:** Solo `admin`

**Respuesta 200:**
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

### Directorio público

```
GET /egresados/directorio?carrera=Sistemas&anio=2022
```

**Auth:** Cualquier usuario autenticado  
**Query params opcionales:** `carrera`, `anio`

**Respuesta 200:** Array con datos no confidenciales + certificaciones y colaboraciones de cada egresado.

---

### Estadísticas generales

```
GET /egresados/estadisticas?carrera=Sistemas&anio=2022
```

**Auth:** Cualquier usuario autenticado  
**Query params opcionales:** `carrera`, `anio`

**Respuesta 200:** Objeto con múltiples secciones:

```typescript
interface Estadisticas {
  kpis: {
    total_egresados: number;
    autorizo_contacto: number;
    autorizo_eventos: number;
    satisfaccion_promedio: number;
    titulados: number;
    en_tramite: number;
    no_titulados: number;
    empleados: number;
    desempleados: number;
  };
  situacionLaboral: { situacion: string; total: number }[];
  empleabilidadCarrera: { nombre_carrera: string; total: number; empleados: number }[];
  titulacionAnio: { anio_egreso: number; total: number; titulados: number; pct_titulados: number }[];
  nivelesIngles: { nivel: string; total: number }[];
  inglesCarrera: { nombre_carrera: string; nivel: string; total: number }[];
  satisfaccionCarrera: { nombre_carrera: string; promedio: number }[];
  topEmpresas: { empresa: string; total: number }[];
  evolucionGeneracion: any[];
  sectorLaboral: any[];
  participacionCarrera: any[];
  fueraMexico: any[];
  fueraDurango: any[];
  coincidenciaCarrera: any[];
  tiempoEmpleoCarrera: any[];
  tiempoEmpleoGeneral: { anios_promedio_general: number };
  titulacionCarrera: any[];
  posgradoPorTipo: any[];
  totalPosgrado: { total: number };
  titulacionCarreraAnio: any[];
}
```

---

### Estadísticas por género

```
GET /egresados/estadisticas/genero?carrera=Sistemas&anio=2022
```

**Auth:** Cualquier usuario autenticado  
**Query params opcionales:** `carrera`, `anio`

**Respuesta 200:** Objeto con 17 secciones analíticas de género (kpisGenero, proporcionCarreraGenero, empleabilidadGenero, titulacionGenero, etc.)

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
    total_mapeados: number;
    con_ciudad_trabajo: number;
    en_extranjero: number;
    paises_distintos: number;
    ciudades_trabajo_distintas: number;
  };
  topCiudadesTrabajo: { ciudad_trabajo: string; total: number }[];
  extranjerosPorPais: { pais: string; total: number }[];
  extranjerosDetalle: { ciudad_trabajo: string; pais: string; total: number }[];
  movilidadPorAnio: any[];
  movilidadPorCarrera: any[];
}
```

---

### Comparativa entre carreras

```
GET /egresados/comparativas?carreras=Sistemas,Industrial,Civil
```

**Auth:** Cualquier usuario autenticado  
**Query:** `carreras` = nombres separados por coma (2–3 carreras)

**Respuesta 200:**
```typescript
interface Comparativas {
  carreras: string[];
  resumen: any[];
  empleo: any[];
  titulacion: any[];
  sectorCarrera: any[];
  ingles: any[];
  satisfaccion: any[];
  migracion: any[];
}
```

---

### Vinculación — egresados por colaboración

```
GET /egresados/vinculacion/colaboracion?tipo=Conferencias&carrera=Sistemas&anio=2022
```

**Auth:** Cualquier usuario autenticado  
**Query:** `tipo` (requerido), `carrera` y `anio` (opcionales)

**Respuesta 200:** Array de `{ id_egresado, nombre_completo, correo, telefono, nombre_carrera, genero, foto_url }`

---

### Vinculación — egresados por habilidad

```
GET /egresados/vinculacion/habilidad?tipo=Liderazgo&carrera=Sistemas&anio=2022
```

**Auth:** Cualquier usuario autenticado  
Misma estructura de respuesta que por colaboración.

---

### Vinculación — totales de colaboraciones

```
GET /egresados/vinculacion/totales-colaboraciones?carrera=Sistemas&anio=2022
```

**Auth:** Cualquier usuario autenticado

**Respuesta 200:** `{ descripcion: string; total: number }[]` — incluye `{ descripcion: '__otro__', total: N }` al final.

---

### Vinculación — totales de habilidades

```
GET /egresados/vinculacion/totales-habilidades?carrera=Sistemas&anio=2022
```

**Auth:** Cualquier usuario autenticado

**Respuesta 200:** `{ habilidad: string; total: number }[]` — incluye `{ habilidad: '__otro__', total: N }` al final.

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

**Respuesta 200:** `{ nivel: number; total: number }[]` (niveles 1–5)

---

### Vinculación — egresados por autorización

```
GET /egresados/vinculacion/autorizacion?tipo=contacto&carrera=Sistemas&anio=2022
```

**Auth:** Cualquier usuario autenticado  
**Query:** `tipo` = `estadisticas` | `contacto` | `eventos`

**Respuesta 200:** Array de `{ id_egresado, nombre_completo, correo, telefono, nombre_carrera, genero, foto_url }`

---

### Exportar lista a PDF

```
GET /egresados/export/pdf?carrera=Sistemas&anio=2022&estatus_titulacion=Titulado
```

**Auth:** Solo `admin`  
**Query (todos opcionales):** `nombre`, `empresa`, `carrera`, `anio`, `situacion_laboral`, `estatus_titulacion`, `autorizo_contacto`, `autorizo_eventos`, `autorizo_estadisticas`

**Respuesta:** Archivo binario `application/pdf` — descarga directa.

---

### Exportar lista a Excel

```
GET /egresados/export/excel?carrera=Sistemas&anio=2022
```

**Auth:** Solo `admin`  
Mismos query params que PDF.

**Respuesta:** Archivo binario `.xlsx` — descarga directa.

---

### Exportar perfil individual a PDF

```
GET /egresados/:id/export/pdf
```

**Auth:** Solo `admin`

**Respuesta:** Archivo binario `application/pdf` — descarga directa.

---

## Módulo: Dashboard

### Resumen general

```
GET /dashboard/resumen
```

**Auth:** Cualquier usuario autenticado

**Respuesta 200:** Objeto grande con todos los KPIs del sistema (similar a `/egresados/estadisticas` pero con más secciones agregadas para el dashboard principal).

---

## Módulo: Notificaciones

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
  tipo: string;           // 'contacto' | 'eventos' | 'nueva_encuesta' | ...
  titulo: string;
  descripcion: string;
  leida: boolean;
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
{ "count": 5 }
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

---

### Eliminar notificaciones leídas

```
DELETE /notificaciones/leidas
```

**Auth:** Cualquier usuario autenticado

---

### Eliminar una notificación

```
DELETE /notificaciones/:id
```

**Auth:** Cualquier usuario autenticado

---

## Módulo: Correo

### Envío masivo de correos

```
POST /correo/enviar
```

**Auth:** Solo `admin`  
**Rate limit:** 2 envíos por minuto por IP

**Body:**
```json
{
  "destinatarios": ["a@example.com", "b@example.com"],
  "asunto": "Invitación a evento",
  "mensaje": "Estimado egresado..."
}
```

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

**Auth:** Cualquier usuario autenticado  
**Respuesta 200:** Objeto `Usuario`

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

**Respuesta 201:**
```json
{
  "usuario": { ...Usuario },
  "contrasena_temporal": "Kp3#mQ9xZ"
}
```

> `contrasena_temporal` es la única vez que se muestra. Mostrarla al admin para que la entregue al usuario.

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

---

### Historial de actividad

```
GET /usuarios/historial?limite=50
```

**Auth:** Solo `admin`  
**Query opcional:** `limite` (default: 50)

**Respuesta 200:**
```typescript
interface HistorialActividad {
  id_historial: number;
  accion: string;
  descripcion: string;
  seccion: string;
  fecha_accion: string;
  usuario: Usuario;
}
```

---

### Historial de un usuario específico

```
GET /usuarios/historial/:id
```

**Auth:** Solo `admin`  
**Respuesta 200:** Array de `HistorialActividad` del usuario indicado.

---

## Catálogos

Todos estos endpoints son **públicos** (sin token). Se usan para poblar los `<select>` del formulario de registro.

| Endpoint | Respuesta |
|---|---|
| `GET /carreras` | `{ id_carrera, nombre_carrera }[]` |
| `GET /generos` | `{ id_genero, genero }[]` |
| `GET /habilidades` | `{ id_habilidad, habilidad }[]` |
| `GET /situacion-laboral` | `{ id_situacion, situacion }[]` |
| `GET /autorizaciones` | `{ id_autorizacion, tipo }[]` |
| `GET /certificaciones-vigentes` | `{ id_certificacion_vigente, respuesta }[]` |
| `GET /titulacion` | `{ id_titulacion, estatus }[]` |
| `GET /antiguedad-empleo` | `{ id_antiguedad, rango }[]` |
| `GET /niveles-ingles` | `{ id_nivel, nivel }[]` |
| `GET /colaboraciones` | `{ id_colaboracion, descripcion }[]` |
| `GET /coincidencia-laboral` | `{ id_coincidencia, nivel }[]` |
| `GET /certificaciones` | `{ id_certificacion, id_egresado, nombre_certificacion }[]` |
| `GET /egresado-habilidades` | `{ id_egresado, id_habilidad }[]` |
| `GET /egresado-colaboraciones` | `{ id_egresado, id_colaboracion }[]` |
| `GET /habilidades-otro` | `{ id_egresado, descripcion }[]` |
| `GET /colaboracion-otro` | `{ id_egresado, descripcion }[]` |
| `GET /satisfaccion-formacion` | `{ id_satisfaccion, nivel }[]` |

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
| `POST /usuarios/login` | ✓ | — | — |
| `POST /egresados/etapa1` | ✓ | — | — |
| `PATCH /egresados/etapa2/:id` | ✓ | — | — |
| `GET /egresados/buscar` | ✓ | — | — |
| `GET /carreras` y demás catálogos | ✓ | — | — |
| `GET /egresados` y estadísticas | — | ✓ | ✓ |
| `GET /egresados/:id/perfil` | — | ✓ | ✓ |
| `GET /dashboard/resumen` | — | ✓ | ✓ |
| `GET /notificaciones/*` | — | ✓ | ✓ |
| `PATCH /notificaciones/*` | — | ✓ | ✓ |
| `DELETE /notificaciones/*` | — | ✓ | ✓ |
| `PATCH /egresados/:id/revisado` | — | — | ✓ |
| `DELETE /egresados/:id` | — | — | ✓ |
| `GET /egresados/export/*` | — | — | ✓ |
| `GET /egresados/pendientes-revision` | — | — | ✓ |
| `GET /usuarios` | — | — | ✓ |
| `POST /usuarios/invitado` | — | — | ✓ |
| `POST /usuarios/admin` | — | — | ✓ |
| `PUT /usuarios/:id/estado` | — | — | ✓ |
| `DELETE /usuarios/:id` | — | — | ✓ |
| `POST /correo/enviar` | — | — | ✓ |
