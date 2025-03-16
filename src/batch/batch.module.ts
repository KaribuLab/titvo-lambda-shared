import { DynamicModule } from '@nestjs/common'
import { BatchService, BatchServiceOptions, createBatchService } from './batch.service'

export interface BatchModuleOptions {
  parameterServiceOptions: BatchServiceOptions
  isGlobal?: boolean
}

// eslint-disable-next-line @typescript-eslint/no-extraneous-class
export class BatchModule {
  static async forRoot (options: BatchModuleOptions): Promise<DynamicModule> {
    return {
      module: BatchModule,
      global: options.isGlobal ?? false,
      providers: [{
        provide: BatchService,
        useFactory: async (): Promise<BatchService> => {
          return createBatchService(options.parameterServiceOptions)
        }
      }],
      exports: [BatchService]
    }
  }
}
