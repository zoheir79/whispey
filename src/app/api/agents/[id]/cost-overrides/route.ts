// src/app/api/agents/[id]/cost-overrides/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { verifyUserAuth } from '@/lib/auth';
import { getUserGlobalRole } from '@/services/getGlobalRole';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { isAuthenticated, userId } = await verifyUserAuth(request);
    
    if (!isAuthenticated || !userId) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const { id } = await params;
    const agentId = parseInt(id);
    if (isNaN(agentId)) {
      return NextResponse.json(
        { error: 'Invalid agent ID' },
        { status: 400 }
      );
    }

    // Get user's global role
    const userGlobalRole = await getUserGlobalRole(userId);
    
    if (!userGlobalRole) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Check permissions: super_admin or agent owner/member
    let hasPermission = userGlobalRole.global_role === 'super_admin';
    
    if (!hasPermission) {
      // Check if user has access to this agent's project
      const accessCheck = await query(`
        SELECT a.id, a.cost_overrides
        FROM pype_voice_agents a
        JOIN pype_voice_email_project_mapping pm ON a.project_id = pm.project_id
        WHERE a.id = $1 AND pm.user_id = $2 AND pm.role IN ('member', 'admin', 'owner')
      `, [agentId, userId]);
      
      hasPermission = accessCheck.rows.length > 0;
    }

    if (!hasPermission) {
      return NextResponse.json(
        { error: 'Access denied' },
        { status: 403 }
      );
    }

    // Get agent with cost overrides
    const result = await query(`
      SELECT 
        id, 
        name, 
        agent_type, 
        pricing_mode, 
        cost_overrides,
        s3_bucket_name
      FROM pype_voice_agents 
      WHERE id = $1
    `, [agentId]);

    if (!result.rows || result.rows.length === 0) {
      return NextResponse.json(
        { error: 'Agent not found' },
        { status: 404 }
      );
    }

    const agent = result.rows[0];
    
    return NextResponse.json({
      agent: {
        id: agent.id,
        name: agent.name,
        agent_type: agent.agent_type,
        pricing_mode: agent.pricing_mode,
        cost_overrides: agent.cost_overrides || {},
        s3_bucket_name: agent.s3_bucket_name
      }
    });

  } catch (error) {
    console.error('Error fetching agent cost overrides:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { isAuthenticated, userId } = await verifyUserAuth(request);
    
    if (!isAuthenticated || !userId) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const { id } = await params;
    const agentId = parseInt(id);
    if (isNaN(agentId)) {
      return NextResponse.json(
        { error: 'Invalid agent ID' },
        { status: 400 }
      );
    }

    // Get user's global role
    const userGlobalRole = await getUserGlobalRole(userId);
    
    if (!userGlobalRole) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Only super_admins can modify cost overrides
    if (userGlobalRole.global_role !== 'super_admin') {
      return NextResponse.json(
        { error: 'Only super administrators can modify cost overrides' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { cost_overrides } = body;

    // Validate cost_overrides structure
    if (cost_overrides && typeof cost_overrides !== 'object') {
      return NextResponse.json(
        { error: 'cost_overrides must be an object' },
        { status: 400 }
      );
    }

    // Validate cost values if provided
    const validKeys = [
      'builtin_stt_cost',
      'builtin_tts_cost', 
      'builtin_llm_cost',
      'external_stt_provider',
      'external_stt_cost',
      'external_tts_provider',
      'external_tts_cost',
      'external_llm_provider',
      'external_llm_cost',
      's3_storage_cost_per_gb'
    ];

    if (cost_overrides) {
      for (const [key, value] of Object.entries(cost_overrides)) {
        if (!validKeys.includes(key)) {
          return NextResponse.json(
            { error: `Invalid override key: ${key}` },
            { status: 400 }
          );
        }
        
        // Validate cost values are numbers
        if (key.includes('cost') && typeof value !== 'number') {
          return NextResponse.json(
            { error: `Cost override ${key} must be a number` },
            { status: 400 }
          );
        }
        
        // Validate provider IDs are integers
        if (key.includes('provider') && (!Number.isInteger(value as number) || (value as number) <= 0)) {
          return NextResponse.json(
            { error: `Provider ID ${key} must be a positive integer` },
            { status: 400 }
          );
        }
      }
    }

    // Check if agent exists
    const agentCheck = await query(`
      SELECT id FROM pype_voice_agents WHERE id = $1
    `, [agentId]);

    if (!agentCheck.rows || agentCheck.rows.length === 0) {
      return NextResponse.json(
        { error: 'Agent not found' },
        { status: 404 }
      );
    }

    // Update cost overrides
    const updateSql = `
      UPDATE pype_voice_agents 
      SET cost_overrides = $2, updated_at = NOW()
      WHERE id = $1
      RETURNING id, name, agent_type, pricing_mode, cost_overrides, s3_bucket_name
    `;

    const result = await query(updateSql, [
      agentId,
      JSON.stringify(cost_overrides || {})
    ]);

    const updatedAgent = result.rows[0];

    console.log(`✅ Successfully updated cost overrides for agent ${agentId}`);

    return NextResponse.json({
      agent: {
        id: updatedAgent.id,
        name: updatedAgent.name,
        agent_type: updatedAgent.agent_type,
        pricing_mode: updatedAgent.pricing_mode,
        cost_overrides: updatedAgent.cost_overrides || {},
        s3_bucket_name: updatedAgent.s3_bucket_name
      }
    });

  } catch (error) {
    console.error('Error updating agent cost overrides:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { isAuthenticated, userId } = await verifyUserAuth(request);
    
    if (!isAuthenticated || !userId) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const { id } = await params;
    const agentId = parseInt(id);
    if (isNaN(agentId)) {
      return NextResponse.json(
        { error: 'Invalid agent ID' },
        { status: 400 }
      );
    }

    // Get user's global role
    const userGlobalRole = await getUserGlobalRole(userId);
    
    if (!userGlobalRole) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Only super_admins can reset cost overrides
    if (userGlobalRole.global_role !== 'super_admin') {
      return NextResponse.json(
        { error: 'Only super administrators can reset cost overrides' },
        { status: 403 }
      );
    }

    // Reset cost overrides to empty object
    const updateSql = `
      UPDATE pype_voice_agents 
      SET cost_overrides = '{}', updated_at = NOW()
      WHERE id = $1
      RETURNING id, name, agent_type, pricing_mode, cost_overrides, s3_bucket_name
    `;

    const result = await query(updateSql, [agentId]);

    if (!result.rows || result.rows.length === 0) {
      return NextResponse.json(
        { error: 'Agent not found' },
        { status: 404 }
      );
    }

    const updatedAgent = result.rows[0];

    console.log(`✅ Successfully reset cost overrides for agent ${agentId}`);

    return NextResponse.json({
      agent: {
        id: updatedAgent.id,
        name: updatedAgent.name,
        agent_type: updatedAgent.agent_type,
        pricing_mode: updatedAgent.pricing_mode,
        cost_overrides: {},
        s3_bucket_name: updatedAgent.s3_bucket_name
      }
    });

  } catch (error) {
    console.error('Error resetting agent cost overrides:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
