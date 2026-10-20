export class DatabaseUnavailableError extends Error {
  readonly code = 'DB_UNAVAILABLE';
  readonly status = 503;

  constructor() {
    super('Database temporarily unavailable');
    this.name = 'DatabaseUnavailableError';
  }
}

export class ResourceAccessError extends Error {
  readonly code = 'RESOURCE_ACCESS_DENIED';
  readonly status = 403;

  constructor() {
    super('Forbidden: resource unavailable in this scope');
    this.name = 'ResourceAccessError';
  }
}

export class DatabaseConfigurationError extends Error {
  readonly code = 'DB_CONFIGURATION_ERROR';

  constructor(message: string) {
    super(message);
    this.name = 'DatabaseConfigurationError';
  }
}

const unavailableCodes = new Set([
  'ECONNREFUSED', 'ECONNRESET', 'ETIMEDOUT', 'EHOSTUNREACH', 'ENETUNREACH', 'ENOTFOUND',
  'EAI_AGAIN', 'PROTOCOL_CONNECTION_LOST', 'PROTOCOL_ENQUEUE_AFTER_FATAL_ERROR',
  'ER_CON_COUNT_ERROR', 'ER_TOO_MANY_USER_CONNECTIONS', 'ER_SERVER_SHUTDOWN',
  'ER_ACCESS_DENIED_ERROR', 'ER_DBACCESS_DENIED_ERROR', 'ER_TABLEACCESS_DENIED_ERROR',
  'ER_COLUMNACCESS_DENIED_ERROR', 'ER_BAD_DB_ERROR', 'POOL_CLOSED',
  'HANDSHAKE_SSL_ERROR', 'HANDSHAKE_NO_SSL_SUPPORT', 'CERT_HAS_EXPIRED',
  'UNABLE_TO_VERIFY_LEAF_SIGNATURE', 'DEPTH_ZERO_SELF_SIGNED_CERT',
  'ERR_TLS_CERT_ALTNAME_INVALID', 'ER_SECURE_TRANSPORT_REQUIRED',
]);

export function isDatabaseUnavailable(error: unknown): boolean {
  return error instanceof DatabaseUnavailableError ||
    (Boolean(error) && typeof error === 'object' &&
      unavailableCodes.has(String((error as { code?: unknown }).code)));
}

export function rethrowSecurityError(error: unknown): void {
  if (error instanceof ResourceAccessError || error instanceof DatabaseConfigurationError) throw error;
  if (isDatabaseUnavailable(error)) throw new DatabaseUnavailableError();
}

// Driver errors may contain SQL parameters. Only log an allowlisted error code.
export function databaseErrorCode(error: unknown): string {
  const code = (error as { code?: unknown } | null)?.code;
  return typeof code === 'string' && /^[A-Z0-9_]+$/.test(code) ? code : 'DB_OPERATION_FAILED';
}
