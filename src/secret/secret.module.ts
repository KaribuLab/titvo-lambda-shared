import { Module, DynamicModule, Provider, Type, ForwardReference } from '@nestjs/common'
import { SecretManagerServiceOptions, createSecretManagerService } from '@aws/secret'
import { SecretService } from '@titvo/shared'
@Module({})
export class SecretModule {
  static forRoot (options: SecretManagerServiceOptions): DynamicModule {
    const secretManagerServiceProvider: Provider = {
      provide: SecretService,
      useFactory: () => {
        return createSecretManagerService(options)
      }
    }

    return {
      module: SecretModule,
      providers: [secretManagerServiceProvider],
      exports: [SecretService],
      global: true
    }
  }

  static forRootAsync (options: {
    imports?: Array<Type<any> | DynamicModule | Promise<DynamicModule> | ForwardReference<any>>
    useFactory: (...args: any[]) => SecretManagerServiceOptions | Promise<SecretManagerServiceOptions>
    inject?: any[]
  }): DynamicModule {
    const secretManagerServiceProvider: Provider = {
      provide: SecretService,
      useFactory: async (...args: any[]) => {
        const config = await options.useFactory(...args)
        return createSecretManagerService(config)
      },
      inject: options.inject ?? []
    }

    const imports = options.imports ?? []

    return {
      module: SecretModule,
      imports,
      providers: [secretManagerServiceProvider],
      exports: [SecretService],
      global: true
    }
  }
}
