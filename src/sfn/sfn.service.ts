import { Injectable, Logger } from '@nestjs/common'
import { SFNClient, StartExecutionCommand, DescribeExecutionCommand, StartSyncExecutionCommand, DescribeExecutionCommandOutput } from '@aws-sdk/client-sfn'
import { DelegatePayload } from '../delegate/delegate.interface'
import { withRetry } from '../utils/aws.util'

export interface SfnServiceOptions {
  awsStage: string
  awsEndpoint: string
}

const StatusRunning = 'RUNNING'
const StatusSucceeded = 'SUCCEEDED'

export class StartingSfnError extends Error {
  constructor (stateMachineArn: string) {
    super(`Error al iniciar la función ${stateMachineArn}`)
    this.name = 'StartingSfnError'
  }
}

export class SyncSfnError extends Error {
  constructor (stateMachineArn: string, state: string) {
    super(`Error al iniciar la función sincrona ${stateMachineArn}: ${state}`)
    this.name = 'SyncSfnError'
  }
}

export class AsyncSfnError extends Error {
  constructor (stateMachineArn: string, state: string) {
    super(`Error al iniciar la función asincrona ${stateMachineArn}: ${state}`)
    this.name = 'AsyncSfnError'
  }
}

async function waitForExecution (sfnClient: SFNClient, executionArn: string, logger: Logger): Promise<DescribeExecutionCommandOutput> {
  while (true) {
    try {
      const response = await withRetry(async () => {
        const command = new DescribeExecutionCommand({ executionArn })
        return await sfnClient.send(command)
      }, `waitForExecution(${executionArn})`, { logger })

      const status = response.status

      logger.log(`Estado de la ejecución: ${status as string}`)

      if (status === StatusRunning) {
        // Espera antes de volver a consultar
        await new Promise((resolve) => setTimeout(resolve, 2000)) // Espera 2 segundos
      } else if (status === StatusSucceeded) {
        // La ejecución ha terminado
        return response
      } else {
        // La ejecución ha terminado con error
        throw new Error(`La ejecución ha terminado con estado ${status as string}`)
      }
    } catch (error) {
      logger.error('Error al describir la ejecución:', error)
      throw error
    }
  }
}

@Injectable()
export class SfnService {
  private readonly logger: Logger = new Logger(SfnService.name)
  constructor (private readonly sfnClient: SFNClient, private readonly awsStage: string) { }

  async startAsyncExecution<I>(stateMachineArn: string, input: DelegatePayload<I> | I): Promise<void> {
    const response = await withRetry(async () => {
      const command = new StartExecutionCommand({
        stateMachineArn,
        input: JSON.stringify(input)
      })
      return await this.sfnClient.send(command)
    }, `startAsyncExecution(${stateMachineArn})`, { logger: this.logger })

    if (response.executionArn === undefined) {
      throw new StartingSfnError(stateMachineArn)
    }
    // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
    this.logger.log(`Ejecución iniciada: ${response.executionArn}`)
  }

  async startExecution<I, O>(stateMachineArn: string, input: DelegatePayload<I> | I): Promise<DelegatePayload<O> | O> {
    const params = {
      stateMachineArn,
      input: JSON.stringify(input)
    }

    if (this.awsStage === 'localstack') {
      const response = await withRetry(async () => {
        const command = new StartExecutionCommand(params)
        return await this.sfnClient.send(command)
      }, `startExecution(${stateMachineArn})`, { logger: this.logger })

      if (response.executionArn !== undefined) {
        const waitResponse = await waitForExecution(this.sfnClient, response.executionArn, this.logger)
        if (waitResponse.output === undefined) {
          throw new StartingSfnError(stateMachineArn)
        }
        // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
        this.logger.log(`Output de la ejecución: ${waitResponse.output}`)
        const output = JSON.parse(waitResponse.output)
        return output.Payload
      } else {
        throw new StartingSfnError(stateMachineArn)
      }
    } else {
      const response = await withRetry(async () => {
        const command = new StartSyncExecutionCommand(params)
        return await this.sfnClient.send(command)
      }, `startSyncExecution(${stateMachineArn})`, { logger: this.logger })

      if (response.status !== StatusSucceeded) {
        throw new SyncSfnError(stateMachineArn, response.status as string)
      }
      if (response.output === undefined) {
        throw new AsyncSfnError(stateMachineArn, response.status as string)
      }
      // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
      this.logger.log(`Output de la ejecución: ${response.output}`)
      const output = JSON.parse(response.output)
      return output.Payload
    }
  }
}

export function createSfnService (options: SfnServiceOptions): SfnService {
  const sfnClient = options.awsStage === 'localstack' ? new SFNClient({ endpoint: options.awsEndpoint }) : new SFNClient()
  return new SfnService(sfnClient, options.awsStage)
}
