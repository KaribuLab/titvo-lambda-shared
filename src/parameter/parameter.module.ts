import { DynamicModule } from '@nestjs/common'
import { createParameterService, ParameterService, ParameterServiceOptions } from './parameter.service'

export interface ParameterModuleOptions {
  parameterServiceOptions: ParameterServiceOptions
  isGlobal?: boolean
}

// eslint-disable-next-line @typescript-eslint/no-extraneous-class
export class ParameterModule {
  static async forRoot (options: ParameterModuleOptions): Promise<DynamicModule> {
    return {
      module: ParameterModule,
      global: options.isGlobal ?? false,
      providers: [{
        provide: ParameterService,
        useFactory: async (): Promise<ParameterService> => {
          const parameterService = createParameterService(options.parameterServiceOptions)
          await parameterService.loadParameters()
          return parameterService
        }
      }],
      exports: [ParameterService]
    }
  }
}
