import { registerDecorator, ValidationOptions } from 'class-validator';

/**
 * Valida que el número no sea mayor al año actual, calculado en cada
 * validación (no al arrancar el proceso), para no depender de un año fijo.
 */
export function MaxCurrentYear(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'maxCurrentYear',
      target: object.constructor,
      propertyName,
      options: validationOptions,
      validator: {
        validate(value: unknown) {
          return typeof value === 'number' && value <= new Date().getFullYear();
        },
        defaultMessage() {
          return `${propertyName} no puede ser mayor a ${new Date().getFullYear()}`;
        },
      },
    });
  };
}
