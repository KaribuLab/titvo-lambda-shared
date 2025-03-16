import { HttpException, HttpStatus } from '@nestjs/common'

export class ValidateRequestException extends HttpException {
  constructor (message: string, details?: any) {
    super(
      {
        statusCode: HttpStatus.BAD_REQUEST,
        message,
        details
      },
      HttpStatus.BAD_REQUEST
    )
  }
}
