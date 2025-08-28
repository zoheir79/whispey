import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { query } from './db';

// Types
export interface User {
  id: string;
  user_id?: string;
  email: string;
  first_name?: string;
  last_name?: string;
  profile_image_url?: string;
  created_at: Date;
  updated_at?: Date;
}

export interface AuthResult {
  success: boolean;
  message?: string;
  user?: User;
  token?: string;
}

// JWT functions
export function generateToken(user: User): string {
  const payload = {
    sub: user.user_id || user.id, // Use user_id if available, fallback to id
    email: user.email,
    name: `${user.first_name || ''} ${user.last_name || ''}`.trim(),
  };

  return jwt.sign(payload, process.env.JWT_SECRET || 'default-secret-change-me', {
    expiresIn: '7d',
  });
}

export function verifyToken(token: string): { valid: boolean; userId?: string; error?: string } {
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'default-secret-change-me');
    return { valid: true, userId: (decoded as any).sub };
  } catch (error) {
    return { valid: false, error: 'Invalid or expired token' };
  }
}

// User authentication functions
export async function registerUser(
  email: string,
  password: string,
  firstName?: string,
  lastName?: string
): Promise<AuthResult> {
  try {
    // Check if user already exists
    const existingUser = await query('SELECT * FROM pype_voice_users WHERE email = $1', [email]);
    if (existingUser.rows.length > 0) {
      return { success: false, message: 'User with this email already exists' };
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Insert new user
    const result = await query(
      'INSERT INTO pype_voice_users (email, password_hash, first_name, last_name) VALUES ($1, $2, $3, $4) RETURNING id, email, first_name, last_name, created_at',
      [email, hashedPassword, firstName || null, lastName || null]
    );

    const user = result.rows[0];
    
    // Link user to any pending workspace invitations
    await linkPendingInvitations(user.id, email);
    
    const token = generateToken(user);

    return {
      success: true,
      user,
      token,
    };
  } catch (error) {
    console.error('Registration error:', error);
    return { success: false, message: 'Registration failed' };
  }
}

export async function loginUser(email: string, password: string): Promise<AuthResult> {
  try {
    // Find user by email
    const result = await query('SELECT * FROM pype_voice_users WHERE email = $1', [email]);
    if (result.rows.length === 0) {
      return { success: false, message: 'Invalid email or password' };
    }

    const user = result.rows[0];

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.password_hash);
    if (!isPasswordValid) {
      return { success: false, message: 'Invalid email or password' };
    }

    // Generate JWT token
    const token = generateToken(user);

    return {
      success: true,
      user: {
        id: user.id,
        user_id: user.user_id,
        email: user.email,
        first_name: user.first_name,
        last_name: user.last_name,
        profile_image_url: user.profile_image_url,
        created_at: user.created_at,
        updated_at: user.updated_at,
      },
      token,
    };
  } catch (error) {
    console.error('Login error:', error);
    return { success: false, message: 'Login failed' };
  }
}

export async function verifyAuth(request: Request): Promise<AuthResult> {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return { success: false, message: 'No valid authorization header' };
    }

    const token = authHeader.substring(7);
    const secret = process.env.JWT_SECRET;
    if (!secret) {
      throw new Error('JWT_SECRET not configured');
    }

    const payload = jwt.verify(token, secret) as any;
    
    // Find user by ID from token
    const result = await query('SELECT * FROM pype_voice_users WHERE id = $1', [payload.sub]);
    if (result.rows.length === 0) {
      return { success: false, message: 'User not found' };
    }

    const user = result.rows[0];
    return {
      success: true,
      user: {
        id: user.id,
        email: user.email,
        first_name: user.first_name,
        last_name: user.last_name,
        profile_image_url: user.profile_image_url,
        created_at: user.created_at,
        updated_at: user.updated_at,
      },
    };
  } catch (error) {
    console.error('Auth verification error:', error);
    return { success: false, message: 'Invalid token' };
  }
}

export async function getUserById(userId: string): Promise<User | null> {
  try {
    const result = await query(
      'SELECT id, user_id, email, first_name, last_name, profile_image_url, created_at, updated_at FROM pype_voice_users WHERE user_id = $1',
      [userId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    return result.rows[0] as User;
  } catch (error) {
    console.error('Get user error:', error);
    return null;
  }
}

// Function to link newly registered users to pending workspace invitations
async function linkPendingInvitations(userId: string, email: string): Promise<void> {
  try {
    // Find all pending invitations for this email (where user_id is null)
    const pendingInvitations = await query(
      'SELECT id FROM pype_voice_email_project_mapping WHERE email = $1 AND user_id IS NULL AND is_active = true',
      [email]
    );

    // Update each pending invitation to link it to the new user
    for (const invitation of pendingInvitations.rows) {
      await query(
        'UPDATE pype_voice_email_project_mapping SET user_id = $1 WHERE id = $2',
        [userId, invitation.id]
      );
    }

    console.log(`Linked ${pendingInvitations.rows.length} pending invitations to user ${userId}`);
  } catch (error) {
    console.error('Error linking pending invitations:', error);
    // Don't throw error here to avoid blocking registration
  }
}
