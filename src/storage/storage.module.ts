import { DynamicModule } from '@nestjs/common'
import { createS3Service, S3Service, S3ServiceOptions } from '@aws/storage'

export interface S3ModuleOptions {
  s3ServiceOptions: S3ServiceOptions
  isGlobal?: boolean
}

// eslint-disable-next-line @typescript-eslint/no-extraneous-class
export class S3Module {
  public static forRoot (options: S3ModuleOptions): DynamicModule {
    return {
      module: S3Module,
      providers: [
        {
          provide: S3Service,
          useFactory: () => createS3Service(options.s3ServiceOptions)
        }
      ],
      exports: [S3Service],
      global: options.isGlobal
    }
  }
}
