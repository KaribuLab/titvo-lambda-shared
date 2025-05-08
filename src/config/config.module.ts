import { DynamicModule } from '@nestjs/common'
import { ConfigOptions, createConfigRepository, DynamoConfigRepository } from '@aws/config/config.dynamo'
import { ConfigService as AWSConfigService } from './config.service'
import { ConfigService } from '@titvo/shared'
export interface ConfigModuleOptions {
  configOptions: ConfigOptions
  isGlobal?: boolean
}

// eslint-disable-next-line @typescript-eslint/no-extraneous-class
export class ConfigModule {
  static forRoot (options: ConfigModuleOptions): DynamicModule {
    return {
      global: options.isGlobal,
      module: ConfigModule,
      providers: [
        {
          provide: ConfigService,
          useClass: AWSConfigService
        },
        {
          provide: DynamoConfigRepository,
          useFactory: () => {
            return createConfigRepository(options.configOptions)
          }
        }
      ],
      exports: [
        ConfigService
      ]
    }
  }
}
