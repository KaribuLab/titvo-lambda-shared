import { BatchClient, SubmitJobCommand } from '@aws-sdk/client-batch'
import { Injectable, Logger } from '@nestjs/common'

export interface BatchServiceOptions {
  awsStage: string
  awsEndpoint: string
}

export interface Environment {
  name: string
  value: string
}

@Injectable()
export class BatchService {
  private readonly logger: Logger = new Logger(BatchService.name)
  constructor (private readonly client: BatchClient) {}
  async submitJob (jobName: string, jobQueue: string, jobDefinition: string, environment: Environment[]): Promise<void> {
    this.logger.log(`Submitting job ${jobName} to queue ${jobQueue} with definition ${jobDefinition}`)
    const command = new SubmitJobCommand({
      jobDefinition,
      jobName,
      jobQueue,
      containerOverrides: {
        environment
      }
    })
    const response = await this.client.send(command)
    this.logger.log(`Job ${jobName} submitted with jobId ${response.jobId as string}`)
  }
}

export function createBatchService (options: BatchServiceOptions): BatchService {
  const awsStage = options.awsStage
  const awsEndpoint = options.awsEndpoint
  const client = awsStage === 'localstack' ? new BatchClient({ endpoint: awsEndpoint }) : new BatchClient()
  return new BatchService(client)
}
