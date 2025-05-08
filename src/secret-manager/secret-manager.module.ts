import { Module, DynamicModule, Provider, Type, ForwardReference } from '@nestjs/common'
import { SecretManagerService, SecretManagerServiceOptions, createSecretManagerService } from '@aws/secret-manager'
import { SecretService } from '@titvo/shared'
@Module({})
export class SecretManagerModule {
  static forRoot (options: SecretManagerServiceOptions): DynamicModule {
    const secretManagerServiceProvider: Provider = {
      provide: SecretService,
      useClass: SecretManagerService,
      useFactory: () => {
        return createSecretManagerService(options)
      }
    }

    return {
      module: SecretManagerModule,
      providers: [secretManagerServiceProvider],
      exports: [secretManagerServiceProvider],
      global: true
    }
  }

  static forRootAsync (options: {
    imports?: Array<Type<any> | DynamicModule | Promise<DynamicModule> | ForwardReference<any>>
    useFactory: (...args: any[]) => SecretManagerServiceOptions | Promise<SecretManagerServiceOptions>
    inject?: any[]
  }): DynamicModule {
    const secretManagerServiceProvider: Provider = {
      provide: SecretManagerService,
      useFactory: async (...args: any[]) => {
        const config = await options.useFactory(...args)
        return createSecretManagerService(config)
      },
      inject: options.inject ?? []
    }

    const imports = options.imports ?? []

    return {
      module: SecretManagerModule,
      imports,
      providers: [secretManagerServiceProvider],
      exports: [secretManagerServiceProvider],
      global: true
    }
  }
}
