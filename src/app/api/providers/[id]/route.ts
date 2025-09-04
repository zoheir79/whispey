// src/app/api/providers/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { verifyUserAuth } from '@/lib/auth';
import { getUserGlobalRole } from '@/services/getGlobalRole';

interface RouteParams {
  params: {
    id: string;
  };
}

export async function GET(request: NextRequest, { params }: RouteParams) {
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

    const providerId = params.id;

    if (!providerId || isNaN(Number(providerId))) {
      return NextResponse.json(
        { error: 'Invalid provider ID' },
        { status: 400 }
      );
    }

    const sql = `
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
      WHERE id = $1
    `;

    const result = await query(sql, [providerId]);
    
    if (!result.rows || result.rows.length === 0) {
      return NextResponse.json(
        { error: 'Provider not found' },
        { status: 404 }
      );
    }

    const provider = result.rows[0];

    return NextResponse.json(provider);

  } catch (error) {
    console.error('Error fetching provider:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
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

    // Only super_admins can update providers
    if (userGlobalRole.global_role !== 'super_admin') {
      return NextResponse.json(
        { error: 'Only super administrators can update AI providers' },
        { status: 403 }
      );
    }

    const providerId = params.id;

    if (!providerId || isNaN(Number(providerId))) {
      return NextResponse.json(
        { error: 'Invalid provider ID' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { name, type, api_url, api_key, unit, cost_per_unit, is_active } = body;

    // Get current provider to validate updates
    const currentProvider = await query(`
      SELECT * FROM ai_providers WHERE id = $1
    `, [providerId]);

    if (!currentProvider.rows || currentProvider.rows.length === 0) {
      return NextResponse.json(
        { error: 'Provider not found' },
        { status: 404 }
      );
    }

    const current = currentProvider.rows[0];
    const updates: any = {};
    const updateFields: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    // Validate and prepare updates
    if (name !== undefined) {
      if (!name.trim()) {
        return NextResponse.json(
          { error: 'Provider name cannot be empty' },
          { status: 400 }
        );
      }
      
      // Check if name already exists for same type (excluding current provider)
      const nameCheck = await query(`
        SELECT id FROM ai_providers 
        WHERE name = $1 AND type = $2 AND id != $3
      `, [name.trim(), current.type, providerId]);

      if (nameCheck.rows && nameCheck.rows.length > 0) {
        return NextResponse.json(
          { error: `Provider "${name.trim()}" already exists for type "${current.type}"` },
          { status: 409 }
        );
      }

      updateFields.push(`name = $${paramIndex}`);
      params.push(name.trim());
      paramIndex++;
    }

    if (type !== undefined) {
      if (!['STT', 'TTS', 'LLM'].includes(type)) {
        return NextResponse.json(
          { error: 'Provider type must be one of: STT, TTS, LLM' },
          { status: 400 }
        );
      }
      updateFields.push(`type = $${paramIndex}`);
      params.push(type);
      paramIndex++;
    }

    if (api_url !== undefined) {
      updateFields.push(`api_url = $${paramIndex}`);
      params.push(api_url || null);
      paramIndex++;
    }

    if (api_key !== undefined) {
      updateFields.push(`api_key = $${paramIndex}`);
      params.push(api_key || null);
      paramIndex++;
    }

    if (unit !== undefined) {
      if (!unit.trim()) {
        return NextResponse.json(
          { error: 'Unit cannot be empty' },
          { status: 400 }
        );
      }

      // Validate unit based on type (use current type if not being updated)
      const targetType = type || current.type;
      const validUnits = {
        STT: ['minute', 'second'],
        TTS: ['word', 'character'],
        LLM: ['token', 'word']
      };

      if (!validUnits[targetType as keyof typeof validUnits].includes(unit)) {
        return NextResponse.json(
          { error: `Invalid unit "${unit}" for type "${targetType}". Valid units: ${validUnits[targetType as keyof typeof validUnits].join(', ')}` },
          { status: 400 }
        );
      }

      updateFields.push(`unit = $${paramIndex}`);
      params.push(unit);
      paramIndex++;
    }

    if (cost_per_unit !== undefined) {
      if (cost_per_unit < 0) {
        return NextResponse.json(
          { error: 'Cost per unit must be a positive number' },
          { status: 400 }
        );
      }
      updateFields.push(`cost_per_unit = $${paramIndex}`);
      params.push(cost_per_unit);
      paramIndex++;
    }

    if (is_active !== undefined) {
      updateFields.push(`is_active = $${paramIndex}`);
      params.push(is_active);
      paramIndex++;
    }

    if (updateFields.length === 0) {
      return NextResponse.json(
        { error: 'No valid fields to update' },
        { status: 400 }
      );
    }

    // Add updated_at
    updateFields.push(`updated_at = NOW()`);

    // Add provider ID as last parameter
    params.push(providerId);

    const updateSql = `
      UPDATE ai_providers 
      SET ${updateFields.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING id, name, type, api_url, unit, cost_per_unit, is_active, created_at, updated_at
    `;

    const result = await query(updateSql, params);
    const updatedProvider = result.rows[0];

    console.log(`✅ Successfully updated ${updatedProvider.type} provider "${updatedProvider.name}"`);

    return NextResponse.json(updatedProvider);

  } catch (error) {
    console.error('Error updating provider:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
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

    // Only super_admins can delete providers
    if (userGlobalRole.global_role !== 'super_admin') {
      return NextResponse.json(
        { error: 'Only super administrators can delete AI providers' },
        { status: 403 }
      );
    }

    const providerId = params.id;

    if (!providerId || isNaN(Number(providerId))) {
      return NextResponse.json(
        { error: 'Invalid provider ID' },
        { status: 400 }
      );
    }

    // Check if provider exists
    const providerCheck = await query(`
      SELECT id, name, type FROM ai_providers WHERE id = $1
    `, [providerId]);

    if (!providerCheck.rows || providerCheck.rows.length === 0) {
      return NextResponse.json(
        { error: 'Provider not found' },
        { status: 404 }
      );
    }

    const provider = providerCheck.rows[0];

    // Check if provider is being used by any agents
    const usageCheck = await query(`
      SELECT COUNT(*) as count FROM pype_voice_agents 
      WHERE provider_config::text LIKE '%"provider_id":' || $1 || '%'
      AND is_active = true
    `, [providerId]);

    if (usageCheck.rows && usageCheck.rows[0].count > 0) {
      return NextResponse.json(
        { error: `Cannot delete provider "${provider.name}" because it is being used by ${usageCheck.rows[0].count} active agent(s)` },
        { status: 409 }
      );
    }

    // Delete the provider
    await query(`DELETE FROM ai_providers WHERE id = $1`, [providerId]);

    console.log(`✅ Successfully deleted ${provider.type} provider "${provider.name}"`);

    return NextResponse.json({ 
      message: `Provider "${provider.name}" deleted successfully` 
    });

  } catch (error) {
    console.error('Error deleting provider:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
