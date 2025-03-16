export enum CircuitBreakerState {
  OPEN = 'OPEN',
  HALF_OPEN = 'HALF_OPEN',
  CLOSED = 'CLOSED'
}

export interface CircuitBreakerDto {
  systemId: string
  state: CircuitBreakerState
  errorThresholdPercentage: number
  maxFailureCount: number
  resetTimeout: number
  failureTimeWindow: number
  failureCount: number
  lastFailureTime: number
}
