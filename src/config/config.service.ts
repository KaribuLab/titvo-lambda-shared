import { Injectable } from '@nestjs/common'
import { DynamoConfigRepository } from '@aws/config/config.dynamo'

@Injectable()
export class ConfigService {
  constructor (private readonly configRepository: DynamoConfigRepository) {}

  async get (name: string): Promise<string> {
    return await this.configRepository.get(name)
  }
}
