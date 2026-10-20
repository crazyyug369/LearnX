export type AccountRole = 'student' | 'teacher' | 'admin' | 'institution';

// Pass this context from verified authentication, never from a request body.
export interface SecurityPrincipal {
  id: string;
  role: AccountRole;
  institutionId?: string;
}

export const isLocalLegacyAuthEnabled = () =>
  process.env.NODE_ENV === 'development' && process.env.ENABLE_LEGACY_AUTH === 'true';

export function isLoopbackRequest(req: { socket?: { remoteAddress?: string } }): boolean {
  const address = req.socket?.remoteAddress;
  return address === '127.0.0.1' || address === '::1' || address === '::ffff:127.0.0.1';
}

export function canManageStudents(actor?: SecurityPrincipal): actor is SecurityPrincipal {
  return Boolean(actor?.id && (actor.role === 'admin' ||
    (['teacher', 'institution'].includes(actor.role) && actor.institutionId)));
}

export function canManageCurriculum(actor?: SecurityPrincipal): actor is SecurityPrincipal {
  return Boolean(actor?.id && (actor.role === 'admin' || actor.role === 'teacher'));
}
