export enum WarmupCommand {
  Ping = 'ping',
  Pong = 'pong',
}

export interface WarmupEvent {
  command: WarmupCommand.Ping
}

export interface WarmupResult {
  command: WarmupCommand.Pong
}
