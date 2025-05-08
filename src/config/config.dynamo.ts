import { DynamoDBClient, GetItemCommand } from '@aws-sdk/client-dynamodb'
import { Logger } from '@nestjs/common'
import { withRetry } from '@aws/utils'
export interface ConfigOptions {
  tableName: string
  awsStage: string
  awsEndpoint: string
}

export class DynamoConfigRepository {
  private readonly logger = new Logger(DynamoConfigRepository.name)

  constructor (
    private readonly dynamoDBClient: DynamoDBClient,
    private readonly tableName: string
  ) {
  }

  async get (name: string): Promise<string> {
    const command = new GetItemCommand({
      TableName: this.tableName,
      Key: {
        parameter_id: {
          S: name
        }
      }
    })

    const result = await withRetry(async () => await this.dynamoDBClient.send(command), 'getConfig', {
      maxRetries: 3,
      maxDelayMs: 1000
    })

    if (result.Item != null) {
      const value = result.Item.value.S as string
      if (value === undefined) {
        throw new Error(`Config value is undefined: ${name}`)
      }
      return value
    }

    throw new Error(`Config not found: ${name}`)
  }
}

export function createConfigRepository (options: ConfigOptions): DynamoConfigRepository {
  const dynamoDBClient = options.awsStage === 'localstack'
    ? new DynamoDBClient({ endpoint: options.awsEndpoint })
    : new DynamoDBClient()

  return new DynamoConfigRepository(dynamoDBClient, options.tableName)
}
