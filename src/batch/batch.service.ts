import { BatchClient, DescribeJobsCommand, JobStatus as JobStatusType, SubmitJobCommand } from '@aws-sdk/client-batch'
import { Injectable, Logger } from '@nestjs/common'

export interface BatchServiceOptions {
  awsStage: string
  batchRunnerUrl?: string
}

export interface Environment {
  name: string
  value: string
}

export interface SubmitJobResponse {
  jobId: string
}

export type JobStatus = (typeof JobStatusType)[keyof typeof JobStatusType]

export interface JobStatusResponse {
  status: JobStatus
  isFailed: boolean
}

@Injectable()
export class BatchService {
  private readonly logger: Logger = new Logger(BatchService.name)
  constructor(
    private readonly client: BatchClient | null,
    private readonly batchRunnerUrl: string | null
  ) { }

  async submitJob(jobName: string, jobQueue: string, jobDefinition: string, environment: Environment[]): Promise<SubmitJobResponse> {
    if (this.batchRunnerUrl !== null) {
      // Usar batch-runner HTTP service
      return await this.submitDockerJob(environment)
    } else if (this.client !== null) {
      // Usar AWS Batch
      return await this.submitAwsBatchJob(jobName, jobQueue, jobDefinition, environment)
    } else {
      throw new Error('Neither batch-runner nor AWS Batch client is available')
    }
  }

  async getJobStatus(jobId: string): Promise<JobStatusResponse> {
    if (this.batchRunnerUrl !== null) {
      // Usar batch-runner HTTP service
      const status = await this.getDockerJobStatus(jobId)
      this.logger.log(`Docker job ${jobId} status: ${status}`)
      const isFailed = status === JobStatusType.FAILED
      return {
        status: status as JobStatus,
        isFailed: isFailed
      }
    } else if (this.client !== null) {
      // Usar AWS Batch
      const status = await this.getAwsBatchJobStatus(jobId)
      this.logger.log(`AWS Batch job ${jobId} status: ${status}`)
      const isFailed = status === JobStatusType.FAILED
      return {
        status: status as JobStatus,
        isFailed: isFailed
      }
    } else {
      throw new Error('Neither batch-runner nor AWS Batch client is available')
    }
  }

  private async getDockerJobStatus(jobId: string): Promise<JobStatus> {
    const response = await fetch(`${this.batchRunnerUrl!}/get-job-status`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      }
    })
    if (!response.ok) {
      throw new Error(`Batch runner returned status ${response.status}`)
    }
    const data = await response.json()
    return data.status! as JobStatus
  }

  private async getAwsBatchJobStatus(jobId: string): Promise<JobStatus> {
    const response = await this.client!.send(new DescribeJobsCommand({
      jobs: [jobId]
    }))
    return response.jobs![0].status! as JobStatus
  }

  private async submitDockerJob(environment: Environment[]): Promise<SubmitJobResponse> {
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
      const data = await response.json()
      return {
        jobId: data.jobId as string
      }
    } catch (error) {
      this.logger.error(`Failed to submit job via batch-runner: ${containerName}`, error)
      throw error
    }
  }

  private async submitAwsBatchJob(jobName: string, jobQueue: string, jobDefinition: string, environment: Environment[]): Promise<SubmitJobResponse> {
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
    return {
      jobId: response.jobId as string
    }
  }
}

export function createBatchService(options: BatchServiceOptions): BatchService {
  const awsStage = options.awsStage
  const batchRunnerUrl = options.batchRunnerUrl

  if (awsStage === 'localstack') {
    // Usar batch-runner HTTP service
    const runnerUrl = batchRunnerUrl ?? 'http://agent:3001'
    return new BatchService(null, runnerUrl)
  } else {
    // Usar AWS Batch para otros stages
    const client = new BatchClient()
    return new BatchService(client, null)
  }
}
