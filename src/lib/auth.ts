import { NextRequest } from 'next/server';

export function hasSharedToken(
  request: NextRequest,
  token?: string
): boolean {
  if (!token) return false;
  const headerToken =
    request.headers.get('x-admin-token') ??
    request.headers.get('authorization')?.replace(/^Bearer\s+/i, '').trim() ??
    '';
  return headerToken === token;
}
