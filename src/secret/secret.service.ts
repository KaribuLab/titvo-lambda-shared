import { Logger } from '@nestjs/common'
import {
  SecretsManagerClient,
  GetSecretValueCommand
} from '@aws-sdk/client-secrets-manager'
import { withRetry } from '@aws/utils/aws.util'
import { SecretService } from '@titvo/shared'
export interface SecretManagerServiceOptions {
  awsStage: string
  awsEndpoint: string
}

export class SecretManagerService extends SecretService {
  private readonly logger: Logger = new Logger(SecretManagerService.name)
  private readonly secretManagerClient: SecretsManagerClient

  constructor (secretManagerClient: SecretsManagerClient) {
    super()
    this.logger.debug('SecretManagerService constructor')
    if (secretManagerClient === undefined) {
      this.logger.error('secretManagerClient is undefined')
      throw new Error('secretManagerClient is undefined')
    }
    this.secretManagerClient = secretManagerClient
  }

  /**
   * Obtiene un secreto desde AWS Secrets Manager
   * @param secretName Nombre del secreto
   * @returns Valor del secreto
   */
  public async get (secretName: string): Promise<string> {
    try {
      const value = await withRetry(async () => {
        const command = new GetSecretValueCommand({
          SecretId: secretName
        })

        const response = await this.secretManagerClient.send(command)
        if (response.SecretString !== undefined) {
          return response.SecretString
        }
        throw new Error(`Secreto no encontrado: ${secretName}`)
      }, `getSecret(${secretName})`, { logger: this.logger })

      return value
    } catch (error) {
      this.logger.error(`Error en getSecret: ${error instanceof Error ? error.message : 'Error desconocido'}`)
      throw error
    }
  }
}

export function createSecretManagerService (options: SecretManagerServiceOptions): SecretService {
  const awsStage = options.awsStage
  const awsEndpoint = options.awsEndpoint

  const secretManagerClient = awsStage === 'localstack'
    ? new SecretsManagerClient({ endpoint: awsEndpoint })
    : new SecretsManagerClient({})

  return new SecretManagerService(secretManagerClient)
}
