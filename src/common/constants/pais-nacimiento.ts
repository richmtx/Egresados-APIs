/**
 * `egresados.pais_nacimiento` es texto libre y guarda DÓNDE NACIÓ la persona,
 * no su nacionalidad. Estas son las formas de escribir México que se
 * reconocen, ya normalizadas con LOWER(TRIM(...)).
 *
 * Es una sola lista a propósito: la usan el reporte de inclusión
 * (`nacidos_fuera_de_mexico`) y el de país de nacimiento de Distribución
 * Geográfica, y si cada uno tuviera la suya los dos conteos dejarían de cuadrar.
 */
export const VARIANTES_MEXICO_SQL =
  `('mexico', 'méxico', 'mx', 'mex', 'méx', 'estados unidos mexicanos')`;
