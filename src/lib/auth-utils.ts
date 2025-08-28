import jwt from 'jsonwebtoken';
import * as bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';
import { query } from './db';

// Types
export interface User {
  id: string;
  user_id?: string;
  email: string;
  first_name?: string;
  last_name?: string;
  global_role?: string;
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

    // Generate unique user_id
    const user_id = uuidv4();

    // Insert user with active status
    const result = await query(
      'INSERT INTO pype_voice_users (user_id, email, password_hash, first_name, last_name, global_role, status, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING user_id, email, first_name, last_name, global_role, status, created_at',
      [user_id, email, hashedPassword, firstName || null, lastName || null, 'user', 'active', new Date().toISOString()]
    );

    const user = result.rows[0];
    
    // Create automatic workspace for the user
    await createUserWorkspace(user.user_id, email);
    
    const token = generateToken(user);

    return {
      success: true,
      user: {
        id: user.user_id,
        user_id: user.user_id,
        email: user.email,
        first_name: user.first_name,
        last_name: user.last_name,
        global_role: user.global_role,
        created_at: new Date(user.created_at)
      },
      token,
    };
  } catch (error) {
    console.error('Registration error:', error);
    return { success: false, message: 'Registration failed' };
  }
}

export async function loginUser(email: string, password: string): Promise<AuthResult> {
  try {
    // Get user by email
    const result = await query('SELECT * FROM pype_voice_users WHERE email = $1', [email]);
    
    if (result.rows.length === 0) {
      return { success: false, message: 'User not found' };
    }

    const user = result.rows[0];

    // Check if user account is active
    if (user.status && user.status !== 'active') {
      if (user.status === 'suspended') {
        return { success: false, message: 'Your account has been suspended. Please contact an administrator.' };
      } else if (user.status === 'pending') {
        return { success: false, message: 'Your account is pending approval. Please wait for an administrator to approve your account.' };
      } else if (user.status === 'rejected') {
        return { success: false, message: 'Your account has been rejected. Please contact an administrator.' };
      }
      return { success: false, message: 'Your account is not active. Please contact an administrator.' };
    }

    // Check password
    const isValidPassword = await bcrypt.compare(password, user.password_hash);
    if (!isValidPassword) {
      return { success: false, message: 'Invalid password' };
    }
    
    const token = generateToken(user);

    return {
      success: true,
      user: {
        id: user.user_id,
        user_id: user.user_id,
        email: user.email,
        first_name: user.first_name,
        last_name: user.last_name,
        global_role: user.global_role,
        created_at: new Date(user.created_at)
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
    const result = await query(
      'UPDATE pype_voice_email_project_mapping SET user_id = $1 WHERE email = $2 AND user_id IS NULL',
      [userId, email]
    );
    console.log(`Linked ${result.rowCount} pending invitations for user ${userId}`);
  } catch (error) {
    console.error('Error linking pending invitations:', error);
  }
}

// Generate workspace code from user_id (8 chars)
function generateWorkspaceCode(user_id: string): string {
  // Create MD5 hash of user_id and take first 8 chars
  const crypto = require('crypto');
  return crypto.createHash('md5').update(user_id).digest('hex').slice(0, 8).toUpperCase();
}

// Create automatic workspace for new user
export async function createUserWorkspace(user_id: string, email: string) {
  try {
    const workspaceCode = generateWorkspaceCode(user_id);
    const workspaceName = `${workspaceCode}-MySpace`;
    const workspace_id = uuidv4();
    
    // Create workspace
    const workspaceResult = await query(
      'INSERT INTO pype_voice_projects (id, name, description, environment, is_active, owner_user_id, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id',
      [workspace_id, workspaceName, `Personal workspace for ${email}`, 'development', true, user_id, new Date().toISOString()]
    );
    
    // Add user as viewer to their workspace
    await query(
      'INSERT INTO pype_voice_email_project_mapping (email, project_id, role, user_id, added_by_user_id, created_at) VALUES ($1, $2, $3, $4, $5, $6)',
      [email, workspace_id, 'viewer', user_id, user_id, new Date().toISOString()]
    );
    
    console.log(`Created workspace ${workspaceName} for user ${user_id}`);
  } catch (error) {
    console.error('Error creating user workspace:', error);
    // Don't throw error to avoid breaking registration
  }
}
