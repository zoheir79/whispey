/**
 * Script utilitaire pour récupérer un token API existant
 * Usage: node scripts/get-api-token.js [project_id]
 */

const { Pool } = require('pg');
require('dotenv').config();

// Configuration DB
const pool = new Pool({
  user: process.env.POSTGRES_USER || 'postgres',
  host: process.env.POSTGRES_HOST || 'localhost',
  database: process.env.POSTGRES_DB || 'whispey',
  password: process.env.POSTGRES_PASSWORD || '',
  port: parseInt(process.env.POSTGRES_PORT || '5432'),
});

async function getAPIToken(projectId = null) {
  try {
    console.log('🔍 Recherche des tokens API disponibles...\n');

    let query = `
      SELECT 
        id as project_id,
        name as project_name,
        token_hash,
        created_at,
        CASE 
          WHEN token_hash IS NOT NULL THEN 'Token disponible'
          ELSE 'Pas de token'
        END as token_status
      FROM pype_voice_projects 
    `;
    
    let params = [];
    
    if (projectId) {
      query += ' WHERE id = $1';
      params = [projectId];
    }
    
    query += ' ORDER BY created_at DESC LIMIT 10';

    const result = await pool.query(query, params);
    
    if (result.rows.length === 0) {
      console.log('❌ Aucun projet trouvé dans la base de données.');
      return;
    }

    console.log('📊 PROJETS DISPONIBLES:');
    console.log('========================\n');
    
    result.rows.forEach((project, index) => {
      console.log(`${index + 1}. Projet: ${project.project_name}`);
      console.log(`   ID: ${project.project_id}`);
      console.log(`   Status: ${project.token_status}`);
      console.log(`   Créé: ${new Date(project.created_at).toLocaleDateString('fr-FR')}`);
      
      if (project.token_hash) {
        console.log('   ✅ Ce projet a un token API configuré');
      } else {
        console.log('   ⚠️  Ce projet n\'a pas de token API');
      }
      console.log('');
    });

    // Si un projet spécifique avec token trouvé
    const projectWithToken = result.rows.find(p => p.token_hash);
    
    if (projectWithToken) {
      console.log('🎉 TOKEN API TROUVÉ !');
      console.log('===================\n');
      console.log(`📋 Projet: ${projectWithToken.project_name}`);
      console.log(`🆔 Project ID: ${projectWithToken.project_id}`);
      console.log('');
      console.log('🔑 UTILISATION:');
      console.log('Pour utiliser ce token avec vos APIs, vous devez récupérer');
      console.log('le token original (non-hashé) depuis votre configuration ou');
      console.log('créer un nouveau token via l\'interface Settings.');
      console.log('');
      console.log('📡 EXEMPLE D\'APPEL API:');
      console.log('curl -X POST https://monvoice.adexgenie.ai/api/logs/call-logs \\');
      console.log('  -H "Content-Type: application/json" \\');
      console.log('  -H "x-pype-token: VOTRE_TOKEN_ORIGINAL_ICI" \\');
      console.log('  -d \'{"call_id": "test", "agent_id": "' + projectWithToken.project_id + '"}\'');
    } else {
      console.log('⚠️  AUCUN TOKEN API CONFIGURÉ');
      console.log('============================\n');
      console.log('Il semble qu\'aucun projet n\'ait de token API configuré.');
      console.log('Vous devrez créer un token via l\'interface Settings/Profile');
      console.log('que nous allons développer ensuite.');
    }

  } catch (error) {
    console.error('❌ Erreur lors de la récupération des tokens:', error.message);
  } finally {
    await pool.end();
  }
}

// Exécution du script
const projectId = process.argv[2];
getAPIToken(projectId);
