import crypto from 'crypto';
import { query } from './db';
import { verifyToken as verifyJwtToken } from './auth-utils';
import { TokenVerificationResult } from '../types/logs';

// This function is for API token verification (project tokens), not JWT auth tokens
export const verifyToken = async (token: string, environment: string = 'dev'): Promise<TokenVerificationResult> => {
  try {
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

    const result = await query(
      'SELECT * FROM pype_voice_projects WHERE token_hash = $1',
      [tokenHash]
    );

    if (result.rows.length === 0) {
      return { valid: false, error: 'Invalid or expired token' };
    }

    const authToken = result.rows[0];

    return { 
      valid: true, 
      token: authToken,
      project_id: authToken.id
    };
  } catch (error) {
    console.error('Token verification error:', error);
    return { valid: false, error: 'Token verification failed' };
  }
};

// Verify user authentication from request (reads JWT from cookies)
export const verifyUserAuth = async (request?: Request): Promise<{ isAuthenticated: boolean; userId?: string }> => {
  try {
    // Get JWT token from cookies (instead of Authorization header)
    const { cookies } = await import('next/headers');
    const cookieStore = await cookies();
    const token = cookieStore.get('auth-token')?.value;

    if (!token) {
      return { isAuthenticated: false };
    }

    const { valid, userId } = verifyJwtToken(token);

    if (!valid || !userId) {
      return { isAuthenticated: false };
    }

    return { isAuthenticated: true, userId };
  } catch (error) {
    console.error('Auth verification error:', error);
    return { isAuthenticated: false };
  }
};
