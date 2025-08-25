// Global role service - handles global permissions that transcend projects
import { query } from '@/lib/db';

export interface GlobalRolePermissions {
  role: 'user' | 'admin' | 'super_admin';
  canViewAllProjects: boolean;
  canViewAllAgents: boolean;
  canViewAllCalls: boolean;
  canManageGlobalSettings: boolean;
}

export interface UserWithGlobalRole {
  id: string;
  user_id: string;
  email: string;
  global_role: string;
  permissions: GlobalRolePermissions;
}

/**
 * Get user's global role and permissions
 */
export async function getUserGlobalRole(userId: string): Promise<UserWithGlobalRole | null> {
  try {
    const result = await query(
      'SELECT id, user_id, email, global_role FROM pype_voice_users WHERE user_id = $1',
      [userId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    const user = result.rows[0];
    const permissions = getPermissionsByGlobalRole(user.global_role);

    return {
      id: user.id,
      user_id: user.user_id,
      email: user.email,
      global_role: user.global_role,
      permissions
    };
  } catch (error) {
    console.error('Error fetching user global role:', error);
    return null;
  }
}

/**
 * Get user's global role by email
 */
export async function getUserGlobalRoleByEmail(email: string): Promise<UserWithGlobalRole | null> {
  try {
    const result = await query(
      'SELECT id, user_id, email, global_role FROM pype_voice_users WHERE email = $1',
      [email]
    );

    if (result.rows.length === 0) {
      return null;
    }

    const user = result.rows[0];
    const permissions = getPermissionsByGlobalRole(user.global_role);

    return {
      id: user.id,
      user_id: user.user_id,
      email: user.email,
      global_role: user.global_role,
      permissions
    };
  } catch (error) {
    console.error('Error fetching user global role by email:', error);
    return null;
  }
}

/**
 * Check if user has global admin access
 */
export async function isGlobalAdmin(userId: string): Promise<boolean> {
  try {
    const user = await getUserGlobalRole(userId);
    return user?.permissions.canViewAllProjects || false;
  } catch (error) {
    console.error('Error checking global admin status:', error);
    return false;
  }
}

/**
 * Check if user has super admin access
 */
export async function isSuperAdmin(userId: string): Promise<boolean> {
  try {
    const user = await getUserGlobalRole(userId);
    return user?.permissions.canManageGlobalSettings || false;
  } catch (error) {
    console.error('Error checking super admin status:', error);
    return false;
  }
}

/**
 * Get permissions based on global role
 */
function getPermissionsByGlobalRole(role: string): GlobalRolePermissions {
  const rolePermissions: Record<string, GlobalRolePermissions> = {
    user: {
      role: 'user',
      canViewAllProjects: false,
      canViewAllAgents: false,
      canViewAllCalls: false,
      canManageGlobalSettings: false,
    },
    admin: {
      role: 'admin',
      canViewAllProjects: true,
      canViewAllAgents: true,
      canViewAllCalls: true,
      canManageGlobalSettings: false,
    },
    super_admin: {
      role: 'super_admin',
      canViewAllProjects: true,
      canViewAllAgents: true,
      canViewAllCalls: true,
      canManageGlobalSettings: true,
    },
  };

  return rolePermissions[role] || rolePermissions['user'];
}

/**
 * Update user's global role (super admin only)
 */
export async function updateUserGlobalRole(
  adminUserId: string, 
  targetUserId: string, 
  newRole: 'user' | 'admin' | 'super_admin'
): Promise<{ success: boolean; error?: string }> {
  try {
    // Check if admin has permission to update roles
    const isSuperAdminUser = await isSuperAdmin(adminUserId);
    if (!isSuperAdminUser) {
      return { success: false, error: 'Only super admins can update global roles' };
    }

    await query(
      'UPDATE pype_voice_users SET global_role = $1 WHERE user_id = $2',
      [newRole, targetUserId]
    );

    return { success: true };
  } catch (error) {
    console.error('Error updating user global role:', error);
    return { success: false, error: 'Failed to update global role' };
  }
}
