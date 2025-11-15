import { BatchClient, SubmitJobCommand } from '@aws-sdk/client-batch'
import { Injectable, Logger } from '@nestjs/common'

export interface BatchServiceOptions {
  awsStage: string
  awsEndpoint: string
  batchRunnerUrl?: string
}

export interface Environment {
  name: string
  value: string
}

@Injectable()
export class BatchService {
  private readonly logger: Logger = new Logger(BatchService.name)
  constructor (
    private readonly client: BatchClient | null,
    private readonly batchRunnerUrl: string | null
  ) {}
  
  async submitJob (jobName: string, jobQueue: string, jobDefinition: string, environment: Environment[]): Promise<void> {
    if (this.batchRunnerUrl !== null) {
      // Usar batch-runner HTTP service
      await this.submitDockerJob(environment)
    } else if (this.client !== null) {
      // Usar AWS Batch
      await this.submitAwsBatchJob(jobName, jobQueue, jobDefinition, environment)
    } else {
      throw new Error('Neither batch-runner nor AWS Batch client is available')
    }
  }

  private async submitDockerJob (environment: Environment[]): Promise<void> {
    const containerName = 'titvo-agent-local'
    this.logger.log(`Submitting Docker job via batch-runner: ${containerName}`)
    
    // Convertir Environment[] a formato Docker
    const envArray = environment.map(env => `${env.name}=${env.value}`)
    
    try {
      const response = await fetch(`${this.batchRunnerUrl!}/run-batch`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          containerName,
          environmentVariables: envArray,
          imageName: 'titvo/agent',
          networkMode: 'titvo-dev_localstack'
        })
      })
      
      if (!response.ok) {
        throw new Error(`Batch runner returned status ${response.status}`)
      }
      
      this.logger.log(`Docker container ${containerName} submitted successfully via batch-runner`)
      this.logger.log(`View logs with: docker logs ${containerName}`)
    } catch (error) {
      this.logger.error(`Failed to submit job via batch-runner: ${containerName}`, error)
      throw error
    }
  }

  private async submitAwsBatchJob (jobName: string, jobQueue: string, jobDefinition: string, environment: Environment[]): Promise<void> {
    this.logger.log(`Submitting job ${jobName} to queue ${jobQueue} with definition ${jobDefinition}`)
    const command = new SubmitJobCommand({
      jobDefinition,
      jobName,
      jobQueue,
      containerOverrides: {
        environment
      }
    })
    const response = await this.client!.send(command)
    this.logger.log(`Job ${jobName} submitted with jobId ${response.jobId as string}`)
  }
}

export function createBatchService (options: BatchServiceOptions): BatchService {
  const awsStage = options.awsStage
  const awsEndpoint = options.awsEndpoint
  const batchRunnerUrl = options.batchRunnerUrl
  
  if (awsStage === 'localstack') {
    // Usar batch-runner HTTP service
    const runnerUrl = batchRunnerUrl ?? 'http://agent:3001'
    return new BatchService(null, runnerUrl)
  } else {
    // Usar AWS Batch para otros stages
    const client = new BatchClient({ endpoint: awsEndpoint })
    return new BatchService(client, null)
  }
}
