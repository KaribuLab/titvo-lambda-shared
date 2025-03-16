import { Injectable, Logger } from '@nestjs/common'
import { SSMClient, GetParametersByPathCommand, PutParameterCommand, GetParameterCommand, DeleteParameterCommand } from '@aws-sdk/client-ssm'
import { withRetry } from '../utils/aws.util'

interface Parameter {
  name: string
  value: string
  sensitive: boolean
}

function getEpochNow (): number {
  return Math.floor(Date.now() / 1000)
}

export interface ParameterServiceOptions {
  ttl: number
  awsStage: string
  awsEndpoint: string
  serviceName: string
  parameterBasePath: string
}

// Configuración de reintentos
const MAX_RETRIES = 5
const BASE_DELAY_MS = 100 // Retraso inicial en milisegundos
const MAX_DELAY_MS = 5000 // Retraso máximo en milisegundos

// Interfaz para errores de AWS
interface AWSError {
  name?: string
  code?: string
  message?: string
  $retryable?: {
    throttling?: boolean
  }
}

@Injectable()
export class ParameterService {
  private readonly logger: Logger = new Logger(ParameterService.name)
  private readonly parameters: Map<string, string>
  private readonly ttl: number
  private readonly parameterBasePath: string
  private readonly awsStage: string
  private readonly client: SSMClient
  private readonly serviceName: string
  private expiredAt: number
  constructor (ttl: number, parameterBasePath: string, awsStage: string, serviceName: string, client: SSMClient) {
    this.parameters = new Map<string, string>()
    this.ttl = ttl
    this.parameterBasePath = parameterBasePath
    this.awsStage = awsStage
    this.serviceName = serviceName
    this.expiredAt = -1
    this.client = client
  }

  /**
   * Ejecuta una función con reintentos exponenciales
   * @param operation Función a ejecutar
   * @param operationName Nombre de la operación para logs
   * @returns Resultado de la operación
   *
   * Utiliza un algoritmo de backoff exponencial con jitter para espaciar los reintentos:
   * - El retraso inicial es BASE_DELAY_MS
   * - Cada reintento duplica el retraso anterior
   * - Se añade un jitter aleatorio (50-100% del valor calculado) para evitar sincronización
   * - El retraso máximo está limitado a MAX_DELAY_MS
   * - Solo se reintenta para errores marcados como reintentables por AWS ($retryable)
   */
  private async withRetry<T>(operation: () => Promise<T>, operationName: string): Promise<T> {
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

        if (isRetryable && retryCount < MAX_RETRIES) {
          retryCount++
          // Cálculo de retraso exponencial con jitter
          const baseDelay = BASE_DELAY_MS * Math.pow(2, retryCount - 1)
          const jitterFactor = 0.5 + Math.random() * 0.5 // Entre 0.5 y 1.0
          const delay = Math.min(MAX_DELAY_MS, baseDelay * jitterFactor)

          this.logger.warn(
            `Error en ${operationName}: ${errorCode} (marcado como reintentable). ` +
            `Reintento ${retryCount}/${MAX_RETRIES} después de ${Math.round(delay)}ms`
          )
          await new Promise(resolve => setTimeout(resolve, delay))
        } else {
          this.logger.error(`Error en ${operationName} después de ${retryCount} reintentos: ${errorMessage}`)
          throw error
        }
      }
    }
  }

  public async putWithouthServiceName (name: string, value: string): Promise<void> {
    await withRetry(async () => {
      const command = new PutParameterCommand({
        Name: `${this.parameterBasePath}/${this.awsStage}/${name}`,
        Value: value,
        Type: 'String',
        Overwrite: true
      })
      const output = await this.client.send(command)
      if (output.Version !== undefined) {
        this.logger.log(`Parameter ${name} version ${output.Version}`)
      }
    }, `putWithouthServiceName(${name})`, { logger: this.logger })
  }

  public async deleteWithoutServiceName (name: string): Promise<void> {
    await withRetry(async () => {
      const command = new DeleteParameterCommand({
        Name: `${this.parameterBasePath}/${this.awsStage}/${name}`
      })
      await this.client.send(command)
    }, `deleteWithoutServiceName(${name})`, { logger: this.logger })
  }

  public async getWithoutServiceName (name: string): Promise<string | null> {
    try {
      return await withRetry(async () => {
        const command = new GetParameterCommand({
          Name: `${this.parameterBasePath}/${this.awsStage}/${name}`,
          WithDecryption: true
        })
        const response = await this.client.send(command)
        if (response.Parameter?.Value !== undefined) {
          return response.Parameter.Value
        }
        return null
      }, `getWithoutServiceName(${name})`, { logger: this.logger })
    } catch (error) {
      this.logger.error(`Error en getWithoutServiceName: ${error instanceof Error ? error.message : 'Error desconocido'}`)
      return null
    }
  }

  public async getParameters (path: string): Promise<Parameter[]> {
    const parameters: Parameter[] = []
    let nextToken: string | undefined

    try {
      do {
        const response = await withRetry(async () => {
          const command = new GetParametersByPathCommand({
            Path: path,
            Recursive: true,
            WithDecryption: true,
            NextToken: nextToken
          })
          return await this.client.send(command)
        }, `getParameters(${path}, nextToken: ${nextToken !== undefined ? 'presente' : 'ausente'})`, { logger: this.logger })

        nextToken = response.NextToken

        if (response.Parameters !== undefined) {
          response.Parameters.forEach(parameter => {
            if (parameter.Name !== undefined && parameter.Value !== undefined) {
              const name = parameter.Name.replace(`${path}/`, '')
              const value = parameter.Value
              const sensitive = parameter.Type === 'SecureString'
              parameters.push({ name, value, sensitive })
            }
          })
        } else {
          this.logger.warn(`Parameters: ${JSON.stringify(response)}`)
        }
      } while (nextToken !== undefined)

      this.logger.debug(`Total de parámetros obtenidos para ${path}: ${parameters.length}`)
      return parameters
    } catch (error) {
      this.logger.error(`Error al obtener parámetros de ${path}: ${error instanceof Error ? error.message : 'Error desconocido'}`)
      throw error
    }
  }

  public async loadParameters (): Promise<void> {
    try {
      this.parameters.clear()
      this.expiredAt = getEpochNow() + this.ttl
      const servicePath = `${this.parameterBasePath}/${this.awsStage}/${this.serviceName}`
      this.logger.debug(`Obteniendo parámetros ${servicePath}`)
      const serviceParameters = await this.getParameters(servicePath)
      serviceParameters.forEach(parameter => {
        if (!parameter.sensitive) {
          this.logger.debug(`Agregando parámetro ${parameter.name} a ${parameter.value}`)
        }
        this.parameters.set(parameter.name, parameter.value)
      })
      const commonPath = `${this.parameterBasePath}/${this.awsStage}/common`
      const commonParameters = await this.getParameters(commonPath)
      commonParameters.forEach(parameter => {
        if (!parameter.sensitive) {
          this.logger.debug(`Agregando parámetro ${parameter.name} a ${parameter.value}`)
        }
        this.parameters.set(parameter.name, parameter.value)
      })
      this.logger.log(`Parámetros cargados: ${JSON.stringify(Array.from(this.parameters.keys()))}`)
    } catch (error) {
      this.logger.error(`Error al cargar parámetros: ${error instanceof Error ? error.message : 'Error desconocido'}`)
      throw error
    }
  }

  public async get<T>(key: string): Promise<T> {
    if (getEpochNow() > this.expiredAt) {
      await this.loadParameters()
    }
    return this.parameters.get(key) as T
  }
}

export function createParameterService (options: ParameterServiceOptions): ParameterService {
  const ttl = options.ttl
  const parameterBasePath = options.parameterBasePath
  const awsStage = options.awsStage
  const awsEndpoint = options.awsEndpoint
  const serviceName = options.serviceName
  const client = awsStage === 'localstack' ? new SSMClient({ endpoint: awsEndpoint }) : new SSMClient()
  return new ParameterService(ttl, parameterBasePath, awsStage, serviceName, client)
}
