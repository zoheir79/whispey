// src/app/api/providers/route.ts
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

    // Only admins and super_admins can view providers
    if (!userGlobalRole.permissions.canViewAllAgents) {
      return NextResponse.json(
        { error: 'Insufficient permissions to view AI providers' },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type'); // STT, TTS, LLM filter

    let sql = `
      SELECT 
        id,
        name,
        type,
        api_url,
        unit,
        cost_per_unit,
        is_active,
        created_at,
        updated_at
      FROM ai_providers 
      WHERE 1=1
    `;
    const params: any[] = [];

    if (type && ['STT', 'TTS', 'LLM'].includes(type)) {
      sql += ` AND type = $${params.length + 1}`;
      params.push(type);
    }

    sql += ` ORDER BY type, name`;

    const result = await query(sql, params);
    const providers = result.rows || [];

    console.log('🔌 PROVIDERS API: Found', providers.length, 'providers');

    return NextResponse.json({
      providers,
      userRole: userGlobalRole.global_role
    });

  } catch (error) {
    console.error('Error fetching providers:', error);
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

    // Only super_admins can create providers
    if (userGlobalRole.global_role !== 'super_admin') {
      return NextResponse.json(
        { error: 'Only super administrators can create AI providers' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { name, type, api_url, api_key, unit, cost_per_unit, is_active = true } = body;

    // Validation
    if (!name || !name.trim()) {
      return NextResponse.json(
        { error: 'Provider name is required' },
        { status: 400 }
      );
    }

    if (!type || !['STT', 'TTS', 'LLM'].includes(type)) {
      return NextResponse.json(
        { error: 'Provider type must be one of: STT, TTS, LLM' },
        { status: 400 }
      );
    }

    if (!unit || !unit.trim()) {
      return NextResponse.json(
        { error: 'Unit is required' },
        { status: 400 }
      );
    }

    if (cost_per_unit === undefined || cost_per_unit < 0) {
      return NextResponse.json(
        { error: 'Cost per unit must be a positive number' },
        { status: 400 }
      );
    }

    // Validate unit based on type
    const validUnits = {
      STT: ['minute', 'second'],
      TTS: ['word', 'character'],
      LLM: ['token', 'word']
    };

    if (!validUnits[type as keyof typeof validUnits].includes(unit)) {
      return NextResponse.json(
        { error: `Invalid unit "${unit}" for type "${type}". Valid units: ${validUnits[type as keyof typeof validUnits].join(', ')}` },
        { status: 400 }
      );
    }

    // Check if provider with same name and type already exists
    const existingCheck = await query(`
      SELECT id FROM ai_providers 
      WHERE name = $1 AND type = $2
    `, [name.trim(), type]);

    if (existingCheck.rows && existingCheck.rows.length > 0) {
      return NextResponse.json(
        { error: `Provider "${name.trim()}" already exists for type "${type}"` },
        { status: 409 }
      );
    }

    // Insert new provider
    const insertSql = `
      INSERT INTO ai_providers (name, type, api_url, api_key, unit, cost_per_unit, is_active)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING id, name, type, api_url, unit, cost_per_unit, is_active, created_at
    `;

    const result = await query(insertSql, [
      name.trim(),
      type,
      api_url || null,
      api_key || null,
      unit,
      cost_per_unit,
      is_active
    ]);

    const provider = result.rows[0];

    console.log(`✅ Successfully created ${type} provider "${provider.name}" with ID: ${provider.id}`);

    return NextResponse.json(provider, { status: 201 });

  } catch (error) {
    console.error('Error creating provider:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
