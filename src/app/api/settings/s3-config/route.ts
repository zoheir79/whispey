// src/app/api/settings/s3-config/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { verifyUserAuth } from '@/lib/auth';
import { getUserGlobalRole } from '@/services/getGlobalRole';
import { s3Manager } from '@/services/s3Manager';

export async function GET(request: NextRequest) {
  try {
    const { isAuthenticated, userId } = await verifyUserAuth(request);
    
    if (!isAuthenticated || !userId) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const userGlobalRole = await getUserGlobalRole(userId);
    
    if (!userGlobalRole) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Only super_admins can view S3 configuration
    if (userGlobalRole.global_role !== 'super_admin') {
      return NextResponse.json(
        { error: 'Only super administrators can access S3 configuration' },
        { status: 403 }
      );
    }

    // Get S3 configuration from settings_global
    const result = await query(`
      SELECT key, value, description, created_at, updated_at 
      FROM settings_global 
      WHERE key = 's3_config'
    `);

    if (!result.rows || result.rows.length === 0) {
      return NextResponse.json(
        { error: 'S3 configuration not found' },
        { status: 404 }
      );
    }

    const s3Config = result.rows[0];
    
    // Masquer les credentials sensibles pour l'affichage
    const safeConfig = { ...s3Config.value };
    if (safeConfig.secret_key) {
      safeConfig.secret_key = '****' + safeConfig.secret_key.slice(-4);
    }

    return NextResponse.json({
      config: {
        ...s3Config,
        value: safeConfig
      }
    });

  } catch (error) {
    console.error('Error fetching S3 configuration:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const { isAuthenticated, userId } = await verifyUserAuth(request);
    
    if (!isAuthenticated || !userId) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const userGlobalRole = await getUserGlobalRole(userId);
    
    if (!userGlobalRole) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Only super_admins can update S3 configuration
    if (userGlobalRole.global_role !== 'super_admin') {
      return NextResponse.json(
        { error: 'Only super administrators can update S3 configuration' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { endpoint, access_key, secret_key, region, bucket_prefix, cost_per_gb } = body;

    // Validation des champs requis
    if (!endpoint || !access_key || !region || !bucket_prefix) {
      return NextResponse.json(
        { error: 'endpoint, access_key, region, and bucket_prefix are required' },
        { status: 400 }
      );
    }

    if (typeof cost_per_gb !== 'number' || cost_per_gb < 0) {
      return NextResponse.json(
        { error: 'cost_per_gb must be a positive number' },
        { status: 400 }
      );
    }

    // Récupérer la configuration actuelle pour préserver secret_key si non fournie
    const currentResult = await query(`
      SELECT value FROM settings_global WHERE key = 's3_config'
    `);

    let finalSecretKey = secret_key;
    
    // Si secret_key n'est pas fournie ou masquée, conserver l'ancienne
    if (!secret_key || secret_key.startsWith('****')) {
      if (currentResult.rows && currentResult.rows.length > 0) {
        const currentConfig = currentResult.rows[0].value;
        finalSecretKey = currentConfig.secret_key;
      } else {
        return NextResponse.json(
          { error: 'secret_key is required for new configuration' },
          { status: 400 }
        );
      }
    }

    const s3Config = {
      endpoint: endpoint.trim(),
      access_key: access_key.trim(),
      secret_key: finalSecretKey,
      region: region.trim(),
      bucket_prefix: bucket_prefix.trim(),
      cost_per_gb: parseFloat(cost_per_gb.toString())
    };

    // Mettre à jour la configuration
    const updateSql = `
      UPDATE settings_global 
      SET value = $1, updated_at = NOW()
      WHERE key = 's3_config'
      RETURNING key, value, description, created_at, updated_at
    `;

    const result = await query(updateSql, [JSON.stringify(s3Config)]);

    if (!result.rows || result.rows.length === 0) {
      return NextResponse.json(
        { error: 'Failed to update S3 configuration' },
        { status: 500 }
      );
    }

    const updatedConfig = result.rows[0];
    
    // Masquer secret_key dans la réponse
    const safeConfig = { ...updatedConfig.value };
    if (safeConfig.secret_key) {
      safeConfig.secret_key = '****' + safeConfig.secret_key.slice(-4);
    }

    console.log('✅ Successfully updated S3 configuration');

    return NextResponse.json({
      config: {
        ...updatedConfig,
        value: safeConfig
      }
    });

  } catch (error) {
    console.error('Error updating S3 configuration:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const { isAuthenticated, userId } = await verifyUserAuth(request);
    
    if (!isAuthenticated || !userId) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const userGlobalRole = await getUserGlobalRole(userId);
    
    if (!userGlobalRole) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Only super_admins can test S3 connection
    if (userGlobalRole.global_role !== 'super_admin') {
      return NextResponse.json(
        { error: 'Only super administrators can test S3 connection' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { action } = body;

    if (action === 'test_connection') {
      // Initialiser le S3Manager avec la config actuelle
      const initialized = await s3Manager.initialize();
      
      if (!initialized) {
        return NextResponse.json(
          { error: 'Failed to initialize S3Manager. Check configuration.' },
          { status: 500 }
        );
      }

      // Tester la connexion
      const connectionTest = await s3Manager.testConnection();
      
      if (connectionTest) {
        return NextResponse.json({
          success: true,
          message: 'S3 connection successful'
        });
      } else {
        return NextResponse.json(
          { error: 'S3 connection failed. Check credentials and endpoint.' },
          { status: 400 }
        );
      }
    }

    if (action === 'get_storage_stats') {
      // Récupérer les statistiques globales de stockage
      const initialized = await s3Manager.initialize();
      
      if (!initialized) {
        return NextResponse.json(
          { error: 'Failed to initialize S3Manager' },
          { status: 500 }
        );
      }

      const stats = await s3Manager.getGlobalStorageStats();
      
      if (stats === null) {
        return NextResponse.json(
          { error: 'Failed to retrieve storage statistics' },
          { status: 500 }
        );
      }

      return NextResponse.json({ stats });
    }

    return NextResponse.json(
      { error: 'Invalid action. Supported actions: test_connection, get_storage_stats' },
      { status: 400 }
    );

  } catch (error) {
    console.error('Error in S3 configuration action:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
