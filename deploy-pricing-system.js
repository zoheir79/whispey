#!/usr/bin/env node

/**
 * WHISPEY PRICING SYSTEM - PRODUCTION DEPLOYMENT SCRIPT
 * 
 * Ce script exécute tous les scripts SQL de migration du système de pricing
 * dans l'ordre OBLIGATOIRE pour éviter les erreurs de dépendances.
 * 
 * PRÉREQUIS:
 * - Base de données PostgreSQL configurée
 * - Variables d'environnement configurées
 * - Backup de la production effectué
 */

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// Configuration base de données
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// Scripts SQL à exécuter dans l'ORDRE OBLIGATOIRE
const MIGRATION_SCRIPTS = [
  {
    name: 'Infrastructure Crédits et Facturation',
    file: 'credit_billing_infrastructure_migration.sql',
    description: 'Tables de base: user_credits, credit_transactions, credit_alerts, triggers RLS'
  },
  {
    name: 'Cycles de Facturation',
    file: 'billing_cycles_tables_migration.sql', 
    description: 'Tables billing_cycles pour agents/KB/workflows/workspaces avec statuts et JSON config'
  },
  {
    name: 'Système Configuration JSON Agents',
    file: 'agent_config_json_system.sql',
    description: 'Colonnes JSONB agents, fonctions validation/update, triggers, templates par défaut'
  },
  {
    name: 'Déduction Automatique et Suspension',
    file: 'auto_billing_deduction_system.sql',
    description: 'Fonctions déduction crédits, auto-recharge, suspension services, billing invoices'
  },
  {
    name: 'Métriques Usage et PAG',
    file: 'sendlog_metrics_system.sql',
    description: 'Tables usage_events/metrics, fonctions logging, agrégation, facturation temps réel'
  }
];

/**
 * Exécute un script SQL et gère les erreurs
 */
async function executeScript(scriptInfo) {
  const filePath = path.join(__dirname, scriptInfo.file);
  
  console.log(`\n🔄 EXÉCUTION: ${scriptInfo.name}`);
  console.log(`📄 Fichier: ${scriptInfo.file}`);
  console.log(`📝 Description: ${scriptInfo.description}`);
  
  try {
    // Vérifier que le fichier existe
    if (!fs.existsSync(filePath)) {
      throw new Error(`Fichier SQL introuvable: ${filePath}`);
    }
    
    // Lire le contenu du script
    const sqlContent = fs.readFileSync(filePath, 'utf8');
    
    if (!sqlContent.trim()) {
      throw new Error(`Fichier SQL vide: ${scriptInfo.file}`);
    }
    
    console.log(`📊 Taille du script: ${(sqlContent.length / 1024).toFixed(2)} KB`);
    
    // Exécuter le script dans une transaction
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(sqlContent);
      await client.query('COMMIT');
      
      console.log(`✅ SUCCÈS: ${scriptInfo.name}`);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
    
  } catch (error) {
    console.error(`❌ ERREUR lors de l'exécution de ${scriptInfo.name}:`);
    console.error(error.message);
    throw error;
  }
}

/**
 * Vérifie l'état de la base de données avant migration
 */
async function checkDatabaseState() {
  console.log('\n🔍 VÉRIFICATION ÉTAT BASE DE DONNÉES...');
  
  try {
    const result = await pool.query(`
      SELECT 
        schemaname,
        tablename,
        tableowner
      FROM pg_tables 
      WHERE schemaname = 'public' 
        AND tablename IN ('user_credits', 'billing_cycles', 'usage_events')
    `);
    
    console.log(`📊 Tables pricing existantes: ${result.rows.length}`);
    result.rows.forEach(row => {
      console.log(`  - ${row.tablename} (owner: ${row.tableowner})`);
    });
    
    return result.rows;
  } catch (error) {
    console.error('❌ Erreur lors de la vérification:', error.message);
    throw error;
  }
}

/**
 * Vérifie l'état après migration
 */
async function verifyMigration() {
  console.log('\n✅ VÉRIFICATION POST-MIGRATION...');
  
  const checks = [
    {
      name: 'Tables Crédits',
      query: `SELECT COUNT(*) as count FROM information_schema.tables WHERE table_name IN ('user_credits', 'credit_transactions', 'credit_alerts')`
    },
    {
      name: 'Tables Billing Cycles', 
      query: `SELECT COUNT(*) as count FROM information_schema.tables WHERE table_name LIKE '%billing_cycles%'`
    },
    {
      name: 'Colonnes JSON Agents',
      query: `SELECT COUNT(*) as count FROM information_schema.columns WHERE table_name = 'pype_voice_agents' AND column_name LIKE '%config%'`
    },
    {
      name: 'Fonctions Billing',
      query: `SELECT COUNT(*) as count FROM information_schema.routines WHERE routine_name LIKE '%billing%' OR routine_name LIKE '%credit%'`
    },
    {
      name: 'Tables Usage Metrics',
      query: `SELECT COUNT(*) as count FROM information_schema.tables WHERE table_name IN ('usage_events', 'usage_metrics_hourly', 'usage_metrics_daily')`
    }
  ];
  
  for (const check of checks) {
    try {
      const result = await pool.query(check.query);
      const count = result.rows[0].count;
      console.log(`📊 ${check.name}: ${count} éléments trouvés`);
    } catch (error) {
      console.error(`❌ Erreur vérification ${check.name}:`, error.message);
    }
  }
}

/**
 * Script principal de déploiement
 */
async function deployPricingSystem() {
  const startTime = Date.now();
  
  console.log('🚀 DÉPLOIEMENT SYSTÈME PRICING WHISPEY');
  console.log('=' .repeat(50));
  console.log(`📅 Date: ${new Date().toISOString()}`);
  console.log(`🔢 Scripts à exécuter: ${MIGRATION_SCRIPTS.length}`);
  
  try {
    // Vérification pré-migration
    await checkDatabaseState();
    
    // Exécution des scripts dans l'ordre
    for (let i = 0; i < MIGRATION_SCRIPTS.length; i++) {
      const script = MIGRATION_SCRIPTS[i];
      console.log(`\n[${i + 1}/${MIGRATION_SCRIPTS.length}]`);
      await executeScript(script);
      
      // Pause entre scripts pour éviter les conflits
      if (i < MIGRATION_SCRIPTS.length - 1) {
        console.log('⏳ Pause de sécurité...');
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
    
    // Vérification post-migration
    await verifyMigration();
    
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`\n🎉 DÉPLOIEMENT COMPLÉTÉ AVEC SUCCÈS !`);
    console.log(`⏱️  Durée totale: ${duration} secondes`);
    console.log(`✅ Tous les scripts ont été exécutés sans erreur`);
    console.log(`📊 Le système de pricing Whispey est maintenant actif !`);
    
  } catch (error) {
    console.error('\n💥 ÉCHEC DU DÉPLOIEMENT !');
    console.error('❌ Erreur:', error.message);
    console.error('\n📋 ACTIONS RECOMMANDÉES:');
    console.error('1. Restaurer le backup de la base de données');
    console.error('2. Vérifier les logs d\'erreur ci-dessus');
    console.error('3. Corriger le problème et relancer le script');
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Exécution du script si appelé directement
if (require.main === module) {
  // Vérification des variables d'environnement
  if (!process.env.DATABASE_URL) {
    console.error('❌ Variable DATABASE_URL manquante !');
    console.error('📋 Définir: export DATABASE_URL="postgresql://user:pass@host:port/db"');
    process.exit(1);
  }
  
  // Confirmation utilisateur en production
  if (process.env.NODE_ENV === 'production') {
    console.log('⚠️  ATTENTION: Déploiement en PRODUCTION !');
    console.log('📋 Assurez-vous d\'avoir:');
    console.log('  - Effectué un backup complet de la base');
    console.log('  - Testé les scripts en staging');
    console.log('  - Planifié une fenêtre de maintenance');
    console.log('\n▶️  Continuez avec: node deploy-pricing-system.js --confirm');
    
    if (!process.argv.includes('--confirm')) {
      console.log('❌ Ajoutez --confirm pour exécuter en production');
      process.exit(1);
    }
  }
  
  deployPricingSystem();
}

module.exports = { deployPricingSystem, executeScript, MIGRATION_SCRIPTS };
