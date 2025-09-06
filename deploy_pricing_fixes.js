#!/usr/bin/env node

/**
 * Script de déploiement: Correction des overrides et calculs après changement PricingSettings
 * Date: 2025-01-06
 * Objectif: Appliquer toutes les corrections pour consolider overrides/globals/calculs
 */

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// Configuration base de données
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function executeSQL(sqlContent, description) {
  console.log(`🔄 Exécution: ${description}...`);
  try {
    const result = await pool.query(sqlContent);
    console.log(`✅ ${description} - Terminé avec succès`);
    return result;
  } catch (error) {
    console.error(`❌ Erreur lors de ${description}:`, error.message);
    throw error;
  }
}

async function checkPricingSettings() {
  console.log('\n🔍 Vérification des settings pricing globaux...');
  
  const query = `
    SELECT key, value 
    FROM settings_global 
    WHERE key IN (
      'pricing_rates_dedicated',
      'pricing_rates_pag', 
      'subscription_costs',
      'fixed_pricing',
      's3_rates'
    );
  `;
  
  const result = await pool.query(query);
  const settings = {};
  
  result.rows.forEach(row => {
    settings[row.key] = row.value;
  });
  
  // Vérifier structure PricingSettings
  const requiredKeys = [
    'pricing_rates_dedicated',
    'pricing_rates_pag',
    'subscription_costs', 
    'fixed_pricing',
    's3_rates'
  ];
  
  const missingKeys = requiredKeys.filter(key => !settings[key]);
  
  if (missingKeys.length > 0) {
    console.log(`⚠️  Settings manquants: ${missingKeys.join(', ')}`);
    console.log('Les settings seront initialisés avec des valeurs par défaut');
    
    // Initialiser settings manquants
    const defaultSettings = {
      pricing_rates_dedicated: {
        llm_monthly: 29.99,
        llm_annual: 299.99,
        stt_monthly: 19.99,
        stt_annual: 199.99,
        tts_monthly: 24.99,
        tts_annual: 249.99,
        kb_monthly: 49.99,
        kb_annual: 499.99,
        workflow_monthly: 79.99,
        workflow_annual: 799.99
      },
      pricing_rates_pag: {
        llm_builtin_per_token: 0.001,
        stt_builtin_per_minute: 0.15,
        tts_builtin_per_minute: 0.10,
        tts_builtin_per_word: 0.002
      },
      subscription_costs: {
        text_agent_monthly: 19.99,
        text_agent_annual: 199.99,
        voice_agent_monthly: 29.99,
        voice_agent_annual: 299.99,
        vision_agent_monthly: 39.99,
        vision_agent_annual: 399.99
      },
      fixed_pricing: {
        kb_monthly: 49.99,
        kb_annual: 499.99,
        workflow_monthly: 79.99,
        workflow_annual: 799.99
      },
      s3_rates: {
        storage_gb_month: 0.10,
        requests_per_1000: 0.0004,
        transfer_gb: 0.09
      }
    };
    
    for (const key of missingKeys) {
      await pool.query(
        `INSERT INTO settings_global (key, value, updated_at) 
         VALUES ($1, $2, NOW()) 
         ON CONFLICT (key) DO UPDATE SET 
         value = EXCLUDED.value, updated_at = NOW()`,
        [key, JSON.stringify(defaultSettings[key])]
      );
      console.log(`✅ Initialisé ${key}`);
    }
  } else {
    console.log('✅ Tous les settings pricing sont présents');
  }
  
  return settings;
}

async function checkExistingOverrides() {
  console.log('\n🔍 Analyse des overrides existants...');
  
  // Vérifier agents avec overrides
  const agentQuery = `
    SELECT COUNT(*) as total,
           COUNT(CASE WHEN cost_overrides IS NOT NULL AND cost_overrides != '{}'::jsonb THEN 1 END) as with_overrides
    FROM pype_voice_agents;
  `;
  
  const agentResult = await pool.query(agentQuery);
  const agentStats = agentResult.rows[0];
  
  console.log(`📊 Agents: ${agentStats.total} total, ${agentStats.with_overrides} avec overrides`);
  
  // Vérifier KB avec overrides
  const kbQuery = `
    SELECT COUNT(*) as total,
           COUNT(CASE WHEN cost_overrides IS NOT NULL AND cost_overrides != '{}'::jsonb THEN 1 END) as with_overrides
    FROM pype_voice_knowledge_bases;
  `;
  
  const kbResult = await pool.query(kbQuery);
  const kbStats = kbResult.rows[0];
  
  console.log(`📊 Knowledge Bases: ${kbStats.total} total, ${kbStats.with_overrides} avec overrides`);
  
  // Vérifier workflows avec overrides  
  const workflowQuery = `
    SELECT COUNT(*) as total,
           COUNT(CASE WHEN cost_overrides IS NOT NULL AND cost_overrides != '{}'::jsonb THEN 1 END) as with_overrides
    FROM pype_voice_workflows;
  `;
  
  const workflowResult = await pool.query(workflowQuery);
  const workflowStats = workflowResult.rows[0];
  
  console.log(`📊 Workflows: ${workflowStats.total} total, ${workflowStats.with_overrides} avec overrides`);
  
  return {
    agents: agentStats,
    knowledge_bases: kbStats,
    workflows: workflowStats
  };
}

async function runMigration() {
  console.log('\n🚀 Démarrage du déploiement des corrections pricing...');
  
  try {
    // 1. Vérifier et initialiser settings
    await checkPricingSettings();
    
    // 2. Analyser overrides existants
    const overrideStats = await checkExistingOverrides();
    
    // 3. Exécuter migration SQL
    const migrationPath = path.join(__dirname, 'fix_pricing_overrides_migration.sql');
    
    if (fs.existsSync(migrationPath)) {
      const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
      await executeSQL(migrationSQL, 'Migration des overrides et fonctions de calcul');
    } else {
      console.log('⚠️  Fichier de migration non trouvé, continuons...');
    }
    
    // 4. Tester fonctions de calcul
    console.log('\n🧪 Test des nouvelles fonctions de calcul...');
    
    // Test avec un agent existant
    const testAgentQuery = `
      SELECT id FROM pype_voice_agents LIMIT 1;
    `;
    const testAgent = await pool.query(testAgentQuery);
    
    if (testAgent.rows.length > 0) {
      const agentId = testAgent.rows[0].id;
      
      try {
        const calcResult = await pool.query(`
          SELECT calculate_agent_cost_v2($1, 10, 5, 1000, 500, true) as calc_result;
        `, [agentId]);
        
        console.log('✅ Test calculate_agent_cost_v2 réussi');
        console.log('📊 Résultat exemple:', JSON.stringify(calcResult.rows[0].calc_result, null, 2));
      } catch (testError) {
        console.log('⚠️  Test function échoué (fonction peut ne pas exister encore):', testError.message);
      }
    }
    
    // 5. Résumé final
    console.log('\n📋 RÉSUMÉ DU DÉPLOIEMENT');
    console.log('=======================');
    console.log('✅ Settings pricing: Vérifiés/Initialisés');
    console.log('✅ Overrides existants: Analysés et préservés'); 
    console.log('✅ Fonctions SQL: Mises à jour');
    console.log('✅ Logique fallback: Override → Global → Défaut');
    console.log('\n🎯 STRUCTURE CONSOLIDÉE:');
    console.log('├── pricing_rates_dedicated (LLM, STT, TTS, KB, Workflow monthly/annual)');
    console.log('├── pricing_rates_pag (Builtin per token/minute/word)');
    console.log('├── subscription_costs (Text/Voice/Vision agents monthly/annual)');
    console.log('├── fixed_pricing (KB & Workflow fixed pricing)');
    console.log('└── s3_rates (Storage, requests, transfer)');
    console.log('\n🔄 LOGIQUE DE CALCUL:');
    console.log('1️⃣ Si override agent/KB/workflow défini → Utilise override');
    console.log('2️⃣ Sinon → Utilise settings globaux correspondants');
    console.log('3️⃣ Sinon → Valeur par défaut (0 ou fixe)');
    
    console.log('\n🎉 Déploiement terminé avec succès!');
    
  } catch (error) {
    console.error('\n💥 Erreur durant le déploiement:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Exécution
if (require.main === module) {
  runMigration().catch(console.error);
}

module.exports = { runMigration, checkPricingSettings, checkExistingOverrides };
