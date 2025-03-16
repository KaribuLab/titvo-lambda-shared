import { DynamicModule } from '@nestjs/common'
import { createStorageService, StorageService, StorageServiceOptions } from './storage.service'

export interface StorageModuleOptions {
  storageServiceOptions: StorageServiceOptions
  isGlobal?: boolean
}

// eslint-disable-next-line @typescript-eslint/no-extraneous-class
export class StorageModule {
  public static forRoot (options: StorageModuleOptions): DynamicModule {
    return {
      module: StorageModule,
      providers: [
        {
          provide: StorageService,
          useFactory: () => createStorageService(options.storageServiceOptions)
        }
      ],
      exports: [StorageService],
      global: options.isGlobal
    }
  }
}
