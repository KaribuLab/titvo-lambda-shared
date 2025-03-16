import { Inject, Logger } from '@nestjs/common'
import { CircuitBreakerService } from './circuit-breaker.service'
import { CircuitBreakerState } from './circuit-breaker.dto'

const logger: Logger = new Logger('CircuitBreaker')

export class CircuitBreakerError extends Error {
  constructor (message: string, public readonly systemId: string) {
    super(message)
    this.name = 'CircuitBreakerError'
  }
}

export interface CircuitBreakerOptions {
  systemId: string
  timeout: number // Tiempo de espera para la solicitud
  fallback?: (() => any) | any // Función o valor alternativo en caso de fallo
}

export function CircuitBreaker (options: CircuitBreakerOptions): any {
  const injectCircuitBreakerService = Inject(CircuitBreakerService)

  return (target: any, _propertyKey: string, descriptor: PropertyDescriptor) => {
    injectCircuitBreakerService(target, 'circuitBreakerService')
    const originalMethod = descriptor.value

    descriptor.value = async function (...args: any[]) {
      // @ts-expect-error: Inyección dinámica de dependencia
      const circuitBreakerService: CircuitBreakerService = this.circuitBreakerService

      // Obtener el estado actual del circuito, con manejo de errores en el service
      const circuitBreakerState = await circuitBreakerService.getState(options.systemId)
      const now = Date.now()

      // Verificación del estado OPEN
      if (circuitBreakerState?.state === CircuitBreakerState.OPEN) {
        logger.debug(`Circuit breaker is open for system ${options.systemId}`)
        const resetTimeout = circuitBreakerState.resetTimeout

        if (now < circuitBreakerState.lastFailureTime + resetTimeout) {
          // Circuito sigue abierto, registrar intento fallido
          circuitBreakerState.failureCount += 1
          circuitBreakerState.lastFailureTime = now
          await circuitBreakerService.upsertState(circuitBreakerState)

          if (options.fallback !== undefined) {
            return typeof options.fallback === 'function' ? options.fallback() : options.fallback
          }

          throw new CircuitBreakerError('Circuit breaker is open. Request blocked to prevent overload.', options.systemId)
        }

        // Cambiar a estado HALF_OPEN si se cumplió el resetTimeout
        circuitBreakerState.state = CircuitBreakerState.HALF_OPEN
        await circuitBreakerService.upsertState(circuitBreakerState)
      } else if (circuitBreakerState != null) {
        logger.debug(`Circuit breaker state for system ${circuitBreakerState.systemId}: ${circuitBreakerState.state}`)
      } else {
        logger.warn(`Circuit breaker state for system ${options.systemId} not found`)
      }
      try {
        // Ejecutar el método original con un timeout controlado
        logger.debug(`Circuit breaker is closed for system ${options.systemId}`)
        const result = await Promise.race([
          originalMethod.apply(this, args),
          new Promise((_resolve, reject) =>
            setTimeout(() => reject(new Error('Circuit breaker timeout exceeded')), options.timeout)
          )
        ])
        logger.debug(`Invocation to ${options.systemId} was successful`)
        // Si estaba en HALF_OPEN y la llamada fue exitosa, cerrar el circuito
        if (circuitBreakerState?.state === CircuitBreakerState.HALF_OPEN) {
          logger.debug(`Circuit breaker is half-open for system ${options.systemId}`)
          circuitBreakerState.state = CircuitBreakerState.CLOSED
          circuitBreakerState.failureCount = 0
          circuitBreakerState.lastFailureTime = now
          await circuitBreakerService.upsertState(circuitBreakerState)
        } else {
          logger.debug(`Circuit breaker is closed for system ${options.systemId}`)
        }
        return result
      } catch (error) {
        logger.error(error)
        // Si ocurre un error, manejar el estado del breaker
        if (circuitBreakerState != null) {
          const timeSinceLastFailure = now - circuitBreakerState.lastFailureTime
          const failureTimeWindow = circuitBreakerState.failureTimeWindow
          circuitBreakerState.failureCount = timeSinceLastFailure > failureTimeWindow ? 1 : circuitBreakerState.failureCount + 1
          circuitBreakerState.lastFailureTime = now

          const maxFailures = circuitBreakerState.maxFailureCount
          const errorThreshold = circuitBreakerState.errorThresholdPercentage
          const failureRate = (circuitBreakerState.failureCount / maxFailures) * 100

          if (failureRate >= errorThreshold) {
            circuitBreakerState.state = CircuitBreakerState.OPEN
          }

          logger.debug(`Circuit breaker is open for system ${options.systemId}`)

          await circuitBreakerService.upsertState(circuitBreakerState)

          if (options.fallback !== undefined) {
            logger.warn(`Circuit breaker fallback for system ${options.systemId}`)
            return typeof options.fallback === 'function' ? options.fallback() : options.fallback
          }
        }

        throw error
      }
    }

    return descriptor
  }
}
