/**
 * Expresión SQL que normaliza un nombre de empresa a su clave de agrupación:
 * minúsculas, sin puntos ni comas, sin sufijos societarios, espacios
 * colapsados.
 *
 * Es la MISMA expresión, carácter por carácter, de la columna generada
 * `empresas.nombre_clave` (migrations/013_empresas.sql). Si aquí se agrupa
 * distinto que en la base, el detector propone grupos que la fusión no
 * encuentra en el catálogo. Por eso vive en un solo lugar: toda consulta que
 * necesite la clave la arma con claveEmpresaSql(), nunca copiando el texto.
 * Si la migración cambia la expresión, se cambia solo aquí.
 *
 * `columna` es un fragmento SQL que escribe el código (una columna o un `?`),
 * NUNCA un valor que venga del usuario: los valores van como parámetros.
 */
export const claveEmpresaSql = (columna: string) =>
  `TRIM(TRIM(TRAILING ' sa' FROM TRIM(TRAILING ' sa de cv' FROM `
  + `TRIM(TRAILING ' sapi de cv' FROM TRIM(TRAILING ' s de rl de cv' FROM `
  + `TRIM(TRAILING ' sc' FROM `
  + `REPLACE(REPLACE(REPLACE(LOWER(TRIM(${columna})), '.', ''), ',', ''), '  ', ' ')`
  + `))))))`;

/**
 * Colación sensible a mayúsculas y acentos. Las columnas de texto usan
 * utf8mb4_0900_ai_ci, donde 'Softtek' = 'SOFTTEK' = 'Sófttek'. Para tratar
 * cada texto crudo como una variante distinta hay que comparar con esta.
 */
export const COLLATE_VARIANTE = 'utf8mb4_0900_as_cs';
