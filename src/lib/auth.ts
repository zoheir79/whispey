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

// Verify user authentication from request
export const verifyUserAuth = async (authHeader: string | null): Promise<{ isAuthenticated: boolean; userId?: string }> => {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { isAuthenticated: false };
  }

  const token = authHeader.split(' ')[1];
  const { valid, userId } = verifyJwtToken(token);

  if (!valid || !userId) {
    return { isAuthenticated: false };
  }

  return { isAuthenticated: true, userId };
};
