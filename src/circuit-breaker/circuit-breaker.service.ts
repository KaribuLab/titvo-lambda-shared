import { DynamoDBClient, GetItemCommand, PutItemCommand } from '@aws-sdk/client-dynamodb'
import { CircuitBreakerDto, CircuitBreakerState } from './circuit-breaker.dto'
import { Logger } from '@nestjs/common'
import { withRetry } from '../utils/aws.util'

export interface CircuitBreakerServiceOptions {
  tableName: string
  awsStage: string
  awsEndpoint: string
}

export class CircuitBreakerService {
  private readonly logger = new Logger(CircuitBreakerService.name)
  constructor (
    private readonly dynamoDBClient: DynamoDBClient,
    private readonly tableName: string
  ) {}

  async getState (systemId: string): Promise<CircuitBreakerDto | null> {
    try {
      const result = await withRetry(async () => {
        return await this.dynamoDBClient.send(
          new GetItemCommand({
            Key: { system_id: { S: systemId } },
            TableName: this.tableName
          })
        )
      }, `getState(${systemId})`, { logger: this.logger })

      if (result.Item == null) return null

      return {
        systemId,
        state: (result.Item.state?.S ?? CircuitBreakerState.CLOSED) as CircuitBreakerState,
        failureCount: parseInt(result.Item.failure_count?.N ?? '0'),
        lastFailureTime: parseInt(result.Item.last_failure_time?.N ?? '0'),
        errorThresholdPercentage: parseInt(result.Item.error_threshold_percentage?.N ?? '0'),
        maxFailureCount: parseInt(result.Item.max_failure_count?.N ?? '0'),
        resetTimeout: parseInt(result.Item.reset_timeout?.N ?? '0'),
        failureTimeWindow: parseInt(result.Item.failure_time_window?.N ?? '0')
      }
    } catch (error) {
      this.logger.warn(`[CircuitBreakerService] Error al obtener estado: ${error instanceof Error ? error.message : 'Error desconocido'}`)
      return null
    }
  }

  async upsertState (circuitBreaker: CircuitBreakerDto): Promise<void> {
    try {
      await withRetry(async () => {
        await this.dynamoDBClient.send(
          new PutItemCommand({
            Item: {
              system_id: { S: circuitBreaker.systemId },
              state: { S: circuitBreaker.state },
              failure_count: { N: circuitBreaker.failureCount.toString() },
              last_failure_time: { N: circuitBreaker.lastFailureTime.toString() },
              error_threshold_percentage: { N: circuitBreaker.errorThresholdPercentage.toString() },
              max_failure_count: { N: circuitBreaker.maxFailureCount.toString() },
              reset_timeout: { N: circuitBreaker.resetTimeout.toString() },
              failure_time_window: { N: circuitBreaker.failureTimeWindow.toString() }
            },
            TableName: this.tableName
          })
        )
      }, `upsertState(${circuitBreaker.systemId})`, { logger: this.logger })
    } catch (error) {
      this.logger.warn(`[CircuitBreakerService] Error al actualizar estado: ${error instanceof Error ? error.message : 'Error desconocido'}`)
    }
  }
}

export function createCircuitBreakerService (options: CircuitBreakerServiceOptions): CircuitBreakerService {
  const dynamoDBClient = options.awsStage === 'localstack' ? new DynamoDBClient({ endpoint: options.awsEndpoint }) : new DynamoDBClient()
  return new CircuitBreakerService(dynamoDBClient, options.tableName)
}
