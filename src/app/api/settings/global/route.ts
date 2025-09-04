// src/app/api/settings/global/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { verifyUserAuth } from '@/lib/auth';
import { getUserGlobalRole } from '@/services/getGlobalRole';

export async function GET(request: NextRequest) {
  try {
    // Verify user authentication
    const { isAuthenticated, userId } = await verifyUserAuth(request);
    
    if (!isAuthenticated || !userId) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Get user's global role and permissions
    const userGlobalRole = await getUserGlobalRole(userId);
    
    if (!userGlobalRole) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Only super_admins can view global settings
    if (userGlobalRole.global_role !== 'super_admin') {
      return NextResponse.json(
        { error: 'Only super administrators can access global settings' },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const key = searchParams.get('key');

    let sql: string;
    let params: any[] = [];

    if (key) {
      // Get specific setting
      sql = `SELECT key, value, description, created_at, updated_at FROM settings_global WHERE key = $1`;
      params = [key];
    } else {
      // Get all settings
      sql = `SELECT key, value, description, created_at, updated_at FROM settings_global ORDER BY key`;
    }

    const result = await query(sql, params);
    
    if (key && (!result.rows || result.rows.length === 0)) {
      return NextResponse.json(
        { error: 'Setting not found' },
        { status: 404 }
      );
    }

    const settings = key ? result.rows[0] : result.rows;

    console.log('⚙️ GLOBAL SETTINGS API: Retrieved', key ? `setting "${key}"` : `${result.rows.length} settings`);

    return NextResponse.json({
      settings,
      userRole: userGlobalRole.global_role
    });

  } catch (error) {
    console.error('Error fetching global settings:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    // Verify user authentication
    const { isAuthenticated, userId } = await verifyUserAuth(request);
    
    if (!isAuthenticated || !userId) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Get user's global role and permissions
    const userGlobalRole = await getUserGlobalRole(userId);
    
    if (!userGlobalRole) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Only super_admins can create global settings
    if (userGlobalRole.global_role !== 'super_admin') {
      return NextResponse.json(
        { error: 'Only super administrators can create global settings' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { key, value, description } = body;

    // Validation
    if (!key || !key.trim()) {
      return NextResponse.json(
        { error: 'Setting key is required' },
        { status: 400 }
      );
    }

    if (value === undefined) {
      return NextResponse.json(
        { error: 'Setting value is required' },
        { status: 400 }
      );
    }

    // Check if setting already exists
    const existingCheck = await query(`
      SELECT id FROM settings_global WHERE key = $1
    `, [key.trim()]);

    if (existingCheck.rows && existingCheck.rows.length > 0) {
      return NextResponse.json(
        { error: `Setting "${key.trim()}" already exists` },
        { status: 409 }
      );
    }

    // Insert new setting
    const insertSql = `
      INSERT INTO settings_global (key, value, description)
      VALUES ($1, $2, $3)
      RETURNING key, value, description, created_at, updated_at
    `;

    const result = await query(insertSql, [
      key.trim(),
      JSON.stringify(value),
      description || null
    ]);

    const setting = result.rows[0];

    console.log(`✅ Successfully created global setting "${setting.key}"`);

    return NextResponse.json(setting, { status: 201 });

  } catch (error) {
    console.error('Error creating global setting:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    // Verify user authentication
    const { isAuthenticated, userId } = await verifyUserAuth(request);
    
    if (!isAuthenticated || !userId) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Get user's global role and permissions
    const userGlobalRole = await getUserGlobalRole(userId);
    
    if (!userGlobalRole) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Only super_admins can update global settings
    if (userGlobalRole.global_role !== 'super_admin') {
      return NextResponse.json(
        { error: 'Only super administrators can update global settings' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { key, value, description } = body;

    // Validation
    if (!key || !key.trim()) {
      return NextResponse.json(
        { error: 'Setting key is required' },
        { status: 400 }
      );
    }

    if (value === undefined) {
      return NextResponse.json(
        { error: 'Setting value is required' },
        { status: 400 }
      );
    }

    // Check if setting exists
    const existingCheck = await query(`
      SELECT id FROM settings_global WHERE key = $1
    `, [key.trim()]);

    if (!existingCheck.rows || existingCheck.rows.length === 0) {
      return NextResponse.json(
        { error: `Setting "${key.trim()}" not found` },
        { status: 404 }
      );
    }

    // Update setting
    const updateSql = `
      UPDATE settings_global 
      SET value = $2, description = $3, updated_at = NOW()
      WHERE key = $1
      RETURNING key, value, description, created_at, updated_at
    `;

    const result = await query(updateSql, [
      key.trim(),
      JSON.stringify(value),
      description || null
    ]);

    const setting = result.rows[0];

    console.log(`✅ Successfully updated global setting "${setting.key}"`);

    return NextResponse.json(setting);

  } catch (error) {
    console.error('Error updating global setting:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
