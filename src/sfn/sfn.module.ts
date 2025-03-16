import { DynamicModule } from '@nestjs/common'
import { createSfnService, SfnService, SfnServiceOptions } from './sfn.service'

export interface SfnModuleOptions {
  sfnServiceOptions: SfnServiceOptions
  isGlobal?: boolean
}

// eslint-disable-next-line @typescript-eslint/no-extraneous-class
export class SfnModule {
  static async forRoot (options: SfnModuleOptions): Promise<DynamicModule> {
    return {
      module: SfnModule,
      global: options.isGlobal ?? false,
      providers: [{
        provide: SfnService,
        useFactory: (): SfnService => {
          return createSfnService(options.sfnServiceOptions)
        }
      }],
      exports: [SfnService]
    }
  }
}
