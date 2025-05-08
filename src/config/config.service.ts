import { Injectable } from '@nestjs/common'
import { DynamoConfigRepository } from '@aws/config/config.dynamo'
import { ConfigService as SharedConfigService } from '@titvo/shared'

@Injectable()
export class ConfigService extends SharedConfigService {
  constructor (private readonly configRepository: DynamoConfigRepository) {
    super()
  }

  async get (name: string): Promise<string> {
    return await this.configRepository.get(name)
  }
}
