import { Injectable, Logger } from '@nestjs/common'
import {
  SecretsManagerClient,
  GetSecretValueCommand,
  CreateSecretCommand,
  UpdateSecretCommand,
  DeleteSecretCommand
} from '@aws-sdk/client-secrets-manager'
import { withRetry } from '@aws/utils/aws.util'
import { SecretService } from '@titvo/shared'
export interface SecretManagerServiceOptions {
  ttl: number
  awsStage: string
  awsEndpoint: string
  serviceName: string
}

function getEpochNow (): number {
  return Math.floor(Date.now() / 1000)
}

@Injectable()
export class SecretManagerService extends SecretService {
  private readonly logger: Logger = new Logger(SecretManagerService.name)
  private readonly secrets: Map<string, string>
  private readonly ttl: number
  private readonly awsStage: string
  private readonly client: SecretsManagerClient
  private readonly serviceName: string
  private expiredAt: number

  constructor (ttl: number, awsStage: string, serviceName: string, client: SecretsManagerClient) {
    super()
    this.secrets = new Map<string, string>()
    this.ttl = ttl
    this.awsStage = awsStage
    this.serviceName = serviceName
    this.expiredAt = -1
    this.client = client
  }

  /**
   * Obtiene un secreto desde AWS Secrets Manager
   * @param secretName Nombre del secreto
   * @returns Valor del secreto o null si no existe
   */
  public async getSecret (secretName: string): Promise<string | null> {
    try {
      const fullSecretName = `${this.awsStage}/${secretName}`

      return await withRetry(async () => {
        const command = new GetSecretValueCommand({
          SecretId: fullSecretName
        })

        const response = await this.client.send(command)
        if (response.SecretString !== undefined) {
          return response.SecretString
        }
        return null
      }, `getSecret(${secretName})`, { logger: this.logger })
    } catch (error) {
      this.logger.error(`Error en getSecret: ${error instanceof Error ? error.message : 'Error desconocido'}`)
      return null
    }
  }

  /**
   * Crea o actualiza un secreto en AWS Secrets Manager
   * @param secretName Nombre del secreto
   * @param secretValue Valor del secreto
   */
  public async putSecret (secretName: string, secretValue: string): Promise<void> {
    const fullSecretName = `${this.awsStage}/${secretName}`

    try {
      // Primero intentamos actualizar el secreto
      await withRetry(async () => {
        const updateCommand = new UpdateSecretCommand({
          SecretId: fullSecretName,
          SecretString: secretValue
        })
        await this.client.send(updateCommand)
      }, `updateSecret(${secretName})`, { logger: this.logger })
    } catch (error) {
      // Si falla, probablemente no existe, así que lo creamos
      if (error instanceof Error && error.name === 'ResourceNotFoundException') {
        try {
          await withRetry(async () => {
            const createCommand = new CreateSecretCommand({
              Name: fullSecretName,
              SecretString: secretValue
            })
            await this.client.send(createCommand)
          }, `createSecret(${secretName})`, { logger: this.logger })
        } catch (createError) {
          this.logger.error(`Error al crear secreto ${secretName}: ${createError instanceof Error ? createError.message : 'Error desconocido'}`)
          throw createError
        }
      } else {
        this.logger.error(`Error al actualizar secreto ${secretName}: ${error instanceof Error ? error.message : 'Error desconocido'}`)
        throw error
      }
    }
  }

  /**
   * Elimina un secreto de AWS Secrets Manager
   * @param secretName Nombre del secreto
   */
  public async deleteSecret (secretName: string, forceDelete: boolean = false): Promise<void> {
    const fullSecretName = `${this.awsStage}/${secretName}`

    await withRetry(async () => {
      const command = new DeleteSecretCommand({
        SecretId: fullSecretName,
        ForceDeleteWithoutRecovery: forceDelete
      })
      await this.client.send(command)
    }, `deleteSecret(${secretName})`, { logger: this.logger })
  }

  /**
   * Carga todos los secretos del servicio en memoria
   */
  public async loadSecrets (): Promise<void> {
    try {
      this.secrets.clear()
      this.expiredAt = getEpochNow() + this.ttl

      // Carga los secretos específicos del servicio
      // En un caso real, aquí tendríamos que listar todos los secretos y filtrar
      // los que comienzan con el prefijo de servicio, pero AWS SDK no proporciona
      // una forma eficiente de filtrar por prefijo en Secrets Manager como lo hace
      // para Parameter Store. Por eso, en implementaciones reales, generalmente se
      // necesitaría conocer los nombres de los secretos de antemano.

      // Esta es una implementación simplificada
      this.logger.log(`Secretos cargados para el servicio ${this.serviceName}`)
    } catch (error) {
      this.logger.error(`Error al cargar secretos: ${error instanceof Error ? error.message : 'Error desconocido'}`)
      throw error
    }
  }

  /**
   * Obtiene un secreto desde la caché, recargando si es necesario
   * @param key Nombre del secreto
   * @returns Valor del secreto
   */
  public async get (key: string): Promise<string> {
    if (getEpochNow() > this.expiredAt) {
      await this.loadSecrets()
    }

    if (!this.secrets.has(key)) {
      const secretValue = await this.getSecret(key)
      if (secretValue !== null && secretValue !== undefined) {
        this.secrets.set(key, secretValue)
      } else {
        throw new Error(`Secreto no encontrado: ${key}`)
      }
    }

    const value = this.secrets.get(key)

    if (value === undefined) {
      throw new Error(`Secreto no encontrado: ${key}`)
    }

    return value
  }
}

export function createSecretManagerService (options: SecretManagerServiceOptions): SecretManagerService {
  const ttl = options.ttl
  const awsStage = options.awsStage
  const awsEndpoint = options.awsEndpoint
  const serviceName = options.serviceName

  const client = awsStage === 'localstack'
    ? new SecretsManagerClient({ endpoint: awsEndpoint })
    : new SecretsManagerClient({})

  return new SecretManagerService(ttl, awsStage, serviceName, client)
}
