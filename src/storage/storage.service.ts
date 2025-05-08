import { Injectable, Logger } from '@nestjs/common'
import { S3Client, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3'
import { Readable } from 'stream'
import { withRetry } from '@aws/utils/aws.util'

export async function readableToString (readable: Readable): Promise<string> {
  return await new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    readable.on('data', (chunk) => chunks.push(chunk))
    readable.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')))
    readable.on('error', reject)
  })
}

export interface StorageServiceOptions {
  awsStage: string
  awsEndpoint: string
}

@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name)
  constructor (private readonly s3Client: S3Client) {}

  public async get (bucket: string, key: string): Promise<Readable> {
    const response = await withRetry(async () => {
      const command = new GetObjectCommand({
        Bucket: bucket,
        Key: key
      })
      return await this.s3Client.send(command)
    }, `get(${bucket}, ${key})`, { logger: this.logger })

    if (response.Body !== undefined) {
      return response.Body as Readable
    }
    throw new Error('No body in response')
  }

  public async put (bucket: string, key: string, data: string): Promise<void> {
    const response = await withRetry(async () => {
      const command = new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: data
      })
      return await this.s3Client.send(command)
    }, `put(${bucket}, ${key})`, { logger: this.logger })

    if (response.$metadata.httpStatusCode !== 200) {
      throw new Error(`Failed to put object ${key} to bucket ${bucket}`)
    }
  }
}

export function createStorageService (options: StorageServiceOptions): StorageService {
  const s3Client = options.awsStage === 'localstack' ? new S3Client({ endpoint: options.awsEndpoint, forcePathStyle: true }) : new S3Client({})
  return new StorageService(s3Client)
}
