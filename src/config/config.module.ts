import { DynamicModule } from '@nestjs/common'
import { ConfigOptions, createConfigRepository, DynamoConfigRepository } from '@aws/config/config.dynamo'
import { ConfigService } from './config.service'
export interface ConfigModuleOptions {
  configOptions: ConfigOptions
  isGlobal?: boolean
}

// eslint-disable-next-line @typescript-eslint/no-extraneous-class
export class ConfigModule {
  static forRoot (options: ConfigOptions): DynamicModule {
    return {
      module: ConfigModule,
      providers: [
        ConfigService,
        {
          provide: DynamoConfigRepository,
          useFactory: () => {
            return createConfigRepository(options)
          }
        }
      ],
      exports: [
        ConfigService
      ]
    }
  }
}
