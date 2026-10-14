// Grados de dificultad que el formulario puede guardar desde la migración 015.
//
// Desde ese cambio, egresado_discapacidad guarda SOLO los dominios que el
// egresado marcó, y siempre con severidad real. "Sin dificultad" es no marcar
// el dominio; "prefiero no declarar" ya no existe como opción. Las filas
// sin_dificultad y no_declara siguen en grados_dificultad (no se borran),
// pero ya no se aceptan al guardar ni se muestran en Inclusión.
//
// Lo usan la validación de la etapa 1 (DTO) y la rejilla de Inclusión, para
// que lo que se acepta y lo que se reporta sean exactamente lo mismo.
export const GRADOS_DISCAPACIDAD_VALIDOS = ['poca_dificultad', 'mucha_dificultad', 'no_puedo'] as const;

export const GRADOS_DISCAPACIDAD_VALIDOS_SQL =
  `(${GRADOS_DISCAPACIDAD_VALIDOS.map(g => `'${g}'`).join(', ')})`;

// Largo de discapacidad_otro.descripcion (VARCHAR(200), migración 015).
export const DISCAPACIDAD_OTRO_MAX = 200;
