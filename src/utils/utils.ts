/* eslint-disable @typescript-eslint/no-extraneous-class */

export class TimeUtils {
  public static async sleep (delay: number): Promise<void> {
    return await new Promise(resolve => setTimeout(resolve, delay))
  }
}

export class Utils {
  static generateUniqueSixDigitNumber (): number {
    return Math.floor(100000 + Math.random() * 900000)
  }

  static isDefined<T>(value: T | undefined | null): value is T {
    return value !== undefined && value !== null && value !== ''
  }
}
