// Script pour exécuter la migration SQL
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// Charger les variables d'environnement depuis .env si disponible
try {
  require('dotenv').config();
} catch (error) {
  console.log('dotenv non installé, utilisation des variables d\'environnement système');
}

// Configuration de la connexion PostgreSQL
const pool = new Pool({
  user: process.env.POSTGRES_USER || 'postgres',
  host: process.env.POSTGRES_HOST || 'localhost',
  database: process.env.POSTGRES_DB || 'whispey',
  password: process.env.POSTGRES_PASSWORD || '',
  port: parseInt(process.env.POSTGRES_PORT || '5432'),
});

async function runMigration() {
  const client = await pool.connect();
  try {
    // Lire le fichier SQL
    const sqlFilePath = path.join(__dirname, 'auth-migration.sql');
    const sqlContent = fs.readFileSync(sqlFilePath, 'utf8');

    console.log('Exécution de la migration SQL...');
    await client.query(sqlContent);
    console.log('Migration terminée avec succès!');
  } catch (error) {
    console.error('Erreur lors de l\'exécution de la migration:', error);
  } finally {
    client.release();
    await pool.end();
  }
}

runMigration();
