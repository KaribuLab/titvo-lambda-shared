import { Logger } from '@nestjs/common'

// Configuración de reintentos
export const DEFAULT_MAX_RETRIES = 5
export const DEFAULT_BASE_DELAY_MS = 100 // Retraso inicial en milisegundos
export const DEFAULT_MAX_DELAY_MS = 5000 // Retraso máximo en milisegundos

// Interfaz para errores de AWS
export interface AWSError {
  name?: string
  code?: string
  message?: string
  $retryable?: {
    throttling?: boolean
  }
}

export interface RetryOptions {
  maxRetries?: number
  baseDelayMs?: number
  maxDelayMs?: number
  logger?: Logger
}

/**
 * Ejecuta una función con reintentos exponenciales para servicios AWS
 * @param operation Función a ejecutar
 * @param operationName Nombre de la operación para logs
 * @param options Opciones de configuración para los reintentos
 * @returns Resultado de la operación
 *
 * Utiliza un algoritmo de backoff exponencial con jitter para espaciar los reintentos:
 * - El retraso inicial es baseDelayMs
 * - Cada reintento duplica el retraso anterior
 * - Se añade un jitter aleatorio (50-100% del valor calculado) para evitar sincronización
 * - El retraso máximo está limitado a maxDelayMs
 * - Solo se reintenta para errores marcados como reintentables por AWS ($retryable)
 */
export async function withRetry<T> (
  operation: () => Promise<T>,
  operationName: string,
  options: RetryOptions = {}
): Promise<T> {
  const maxRetries = options.maxRetries ?? DEFAULT_MAX_RETRIES
  const baseDelayMs = options.baseDelayMs ?? DEFAULT_BASE_DELAY_MS
  const maxDelayMs = options.maxDelayMs ?? DEFAULT_MAX_DELAY_MS
  const logger = options.logger ?? new Logger('AWSUtil')

  let retryCount = 0

  while (true) {
    try {
      return await operation()
    } catch (error) {
      const awsError = error as AWSError
      const errorCode = awsError.name ?? awsError.code ?? 'UnknownError'
      const errorMessage = awsError.message ?? 'No error message'

      // Determinar si el error es reintentable solo por el atributo $retryable
      const isRetryable = awsError.$retryable !== undefined

      if (isRetryable && retryCount < maxRetries) {
        retryCount++
        // Cálculo de retraso exponencial con jitter
        const baseDelay = baseDelayMs * Math.pow(2, retryCount - 1)
        const jitterFactor = 0.5 + Math.random() * 0.5 // Entre 0.5 y 1.0
        const delay = Math.min(maxDelayMs, baseDelay * jitterFactor)

        logger.warn(
          `Error en ${operationName}: ${errorCode} (marcado como reintentable). ` +
          `Reintento ${retryCount}/${maxRetries} después de ${Math.round(delay)}ms`
        )
        await new Promise(resolve => setTimeout(resolve, delay))
      } else {
        logger.error(`Error en ${operationName} después de ${retryCount} reintentos: ${errorMessage}`)
        throw error
      }
    }
  }
}
