import { LambdaClient, InvokeCommand } from '@aws-sdk/client-lambda'
import { Logger } from '@nestjs/common'
import { withRetry } from '../utils/aws.util'

export interface LambdaServiceOptions {
  awsStage: string
  awsEndpoint: string
}

export class LambdaService {
  private readonly logger = new Logger(LambdaService.name)
  constructor (private readonly lambdaClient: LambdaClient) {}

  async invokeLambda<I, O>(functionName: string, payload: I): Promise<O> {
    return await withRetry(async () => {
      const command = new InvokeCommand({
        FunctionName: functionName,
        Payload: JSON.stringify(payload)
      })
      const response = await this.lambdaClient.send(command)
      if (response.Payload !== undefined) {
        const payloadString = Buffer.from(response.Payload as Uint8Array).toString('utf-8')
        this.logger.log(`Lambda function ${functionName} invoked successfully: ${payloadString}`)
        return JSON.parse(payloadString)
      }
      throw new Error('Invalid response')
    }, `invokeLambda(${functionName})`, { logger: this.logger })
  }
}

export async function creatLambdaService (options: LambdaServiceOptions): Promise<LambdaService> {
  const lambdaClient = options.awsStage === 'localstack' ? new LambdaClient({ endpoint: options.awsEndpoint }) : new LambdaClient()
  return new LambdaService(lambdaClient)
}
