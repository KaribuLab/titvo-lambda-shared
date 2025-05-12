import { Injectable, Logger } from '@nestjs/common'
import { S3Client, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
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

export interface S3ServiceOptions {
  awsStage: string
  awsEndpoint: string
}

@Injectable()
export class S3Service {
  private readonly logger = new Logger(S3Service.name)
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

  async getSignedUrl (bucket: string, key: string, contentType: string, expiresIn: number): Promise<string> {
    const command = new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      ContentType: contentType
    })
    return await getSignedUrl(this.s3Client, command, {
      expiresIn
    })
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

export function createS3Service (options: S3ServiceOptions): S3Service {
  const s3Client = options.awsStage === 'localstack' ? new S3Client({ endpoint: options.awsEndpoint, forcePathStyle: true }) : new S3Client({})
  return new S3Service(s3Client)
}
