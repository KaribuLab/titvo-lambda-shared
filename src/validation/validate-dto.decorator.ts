import { validate } from 'class-validator'
import { plainToInstance } from 'class-transformer'
// import { ValidateRequestException } from './validate-request.exception'

export function ValidateDto<T> (dtoClass: new () => T) {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value

    descriptor.value = async function (...args: any[]) {
      const dtoObject = plainToInstance(dtoClass, args[0]) as object
      const errors = await validate(dtoObject)
      if (errors.length > 0) {
        const formattedErrors = errors.map(error => ({
          field: error.property,
          errors: error.constraints
        }))
        // ToDo: Validar si la respuesta sera un json o un error propagado
        return { valid: false, errors: formattedErrors }
        // throw new ValidateRequestException('Validation failed', formattedErrors)
      }
      return originalMethod.apply(this, args)
    }

    return descriptor
  }
}
