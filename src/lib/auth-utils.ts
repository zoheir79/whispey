import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { query } from './db';

// Types
export interface User {
  id: string;
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
    sub: user.id,
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

export async function getUserById(userId: string): Promise<User | null> {
  try {
    const result = await query(
      'SELECT id, email, first_name, last_name, profile_image_url, created_at, updated_at FROM pype_voice_users WHERE id = $1',
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
