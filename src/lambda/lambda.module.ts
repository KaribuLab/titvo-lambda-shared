import { DynamicModule } from '@nestjs/common'
import { creatLambdaService, LambdaService, LambdaServiceOptions } from '@aws/lambda'

export interface LambdaModuleOptions {
  lambdaServiceOptions: LambdaServiceOptions
  isGlobal: boolean
}

// eslint-disable-next-line @typescript-eslint/no-extraneous-class
export class LambdaModule {
  static async forRoot (options: LambdaModuleOptions): Promise<DynamicModule> {
    return {
      module: LambdaModule,
      global: options.isGlobal,
      providers: [
        {
          provide: LambdaService,
          useFactory: async () => {
            return await creatLambdaService(options.lambdaServiceOptions)
          }
        }
      ],
      exports: [LambdaService]
    }
  }
}
