export interface DelegatePayload<T> {
  tenantId: string
  channelTransactionId: string
  channelName: string
  serviceName: string
  requestId: string
  state: string
  payload: T
  status: DelegateStatus
}

export interface DelegateStatus {
  code: string
  message: string
  aditionalInfo?: string
}
