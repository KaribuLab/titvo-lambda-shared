import { Logger } from '@nestjs/common'

export function handleServiceError (logger: Logger, error: Error | unknown, serviceName: string): void {
  if (isAxiosError(error)) {
    logger.error(`Axios Error in ${serviceName}:`, (error as unknown as Error).stack)
    logger.error('Response:', error.response?.data)
  } else if (error instanceof Error) {
    logger.error(`Error in ${serviceName}:`, error.stack)
  } else {
    logger.error(`Unknown error in ${serviceName}:`, error)
  }
}

// Tipo guard para verificar si el error es de Axios
function isAxiosError (error: unknown): error is { isAxiosError: boolean, response?: any } {
  return typeof error === 'object' && error !== null && 'isAxiosError' in error
}
