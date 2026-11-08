export type ErrorCode =
  | 'VALIDATION_ERROR'
  | 'UNAUTHENTICATED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'RATE_LIMITED'
  | 'PAYLOAD_TOO_LARGE'
  | 'INVALID_STATE'
  | 'INTERNAL_ERROR';

export class AppError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: ErrorCode,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'AppError';
  }

  static validation(message: string, details?: unknown) { return new AppError(400, 'VALIDATION_ERROR', message, details); }
  static unauthenticated(message = 'Sign in to continue.') { return new AppError(401, 'UNAUTHENTICATED', message); }
  static forbidden(message = 'You do not have permission to do that.') { return new AppError(403, 'FORBIDDEN', message); }
  static notFound(message = 'Not found.') { return new AppError(404, 'NOT_FOUND', message); }
  static conflict(message: string) { return new AppError(409, 'CONFLICT', message); }
  static invalidState(message: string) { return new AppError(409, 'INVALID_STATE', message); }
}
