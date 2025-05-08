import { DynamicModule } from '@nestjs/common'
import { CircuitBreakerService, createCircuitBreakerService, CircuitBreakerServiceOptions } from '@aws/circuit-breaker'

export interface CircuitBreakerModuleOptions {
  circuitBreakerServiceOptions: CircuitBreakerServiceOptions
  isGlobal?: boolean
}

// eslint-disable-next-line @typescript-eslint/no-extraneous-class
export class CircuitBreakerModule {
  static async forRoot (options: CircuitBreakerModuleOptions): Promise<DynamicModule> {
    return {
      module: CircuitBreakerModule,
      global: options.isGlobal ?? false,
      providers: [
        {
          provide: CircuitBreakerService,
          useFactory: () => {
            return createCircuitBreakerService(options.circuitBreakerServiceOptions)
          }
        }
      ],
      exports: [
        CircuitBreakerService
      ]
    }
  }
}
