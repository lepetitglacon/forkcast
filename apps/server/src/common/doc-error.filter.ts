import { ArgumentsHost, Catch, ExceptionFilter } from '@nestjs/common';
import type { Response } from 'express';
import { DocError, DocErrorCode } from '@forkcast/doc';

export function docErrorStatus(code: DocErrorCode): number {
  switch (code) {
    case 'NODE_NOT_FOUND':
    case 'CRITERION_NOT_FOUND':
      return 404;
    case 'VALIDATION':
    case 'NOT_INITIALIZED':
    case 'UNSUPPORTED_VERSION':
      return 400;
    case 'LIMIT_EXCEEDED':
      return 413;
    default:
      return 409;
  }
}

/** Maps business errors of @forkcast/doc to HTTP responses. */
@Catch(DocError)
export class DocErrorFilter implements ExceptionFilter<DocError> {
  catch(exception: DocError, host: ArgumentsHost): void {
    const res = host.switchToHttp().getResponse<Response>();
    const status = docErrorStatus(exception.code);
    res.status(status).json({ statusCode: status, message: exception.message, code: exception.code, details: exception.details });
  }
}
