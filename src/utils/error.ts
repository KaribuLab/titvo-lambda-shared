export function extractAdditionalInfo (error: any): any {
  if (error.stack !== undefined) {
    return error.stack
  }
  return error.message ?? error
}
