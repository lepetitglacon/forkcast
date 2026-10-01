export type DocErrorCode =
  | 'NOT_INITIALIZED'
  | 'NODE_NOT_FOUND'
  | 'CRITERION_NOT_FOUND'
  | 'CRITERION_EXISTS'
  | 'INVALID_MOVE'
  | 'ROOT_IMMUTABLE'
  | 'HAS_CHILDREN'
  | 'VALIDATION'
  | 'LIMIT_EXCEEDED'
  | 'ID_CONFLICT'
  | 'UNSUPPORTED_VERSION';

/** Typed business error raised by commands, snapshot and import. */
export class DocError extends Error {
  override readonly name = 'DocError';
  constructor(
    readonly code: DocErrorCode,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
  }

  toJSON(): { code: DocErrorCode; message: string; details?: unknown } {
    return { code: this.code, message: this.message, details: this.details };
  }
}

export function isDocError(error: unknown): error is DocError {
  return error instanceof DocError || (typeof error === 'object' && error !== null && (error as { name?: string }).name === 'DocError');
}
