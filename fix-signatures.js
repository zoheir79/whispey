// Script pour corriger TOUTES les signatures de fonctions db-service en une fois
const fs = require('fs');
const path = require('path');

// Liste des fichiers à corriger (identifiés par grep)
const filesToFix = [
  // fetchFromTable errors
  'src/services/customTotalService.tsx',
  'src/services/getUserRole.ts',
  
  // insertIntoTable errors
  'src/app/api/send-logs/route.ts',
  'src/app/api/agents/route.ts',
  'src/app/api/projects/[id]/members/route.ts',
  'src/app/api/logs/call-logs/route.ts',
  'src/app/api/projects/route.ts',
  'src/app/api/logs/failure-report/route.ts',
  
  // updateTable errors
  'src/app/api/campaign/route.ts',
];

// Fonction pour corriger un fichier
function fixFileSignatures(filePath) {
  const fullPath = path.join(__dirname, filePath);
  
  if (!fs.existsSync(fullPath)) {
    console.log(`⚠️  File not found: ${filePath}`);
    return;
  }
  
  console.log(`🔧 Fixing: ${filePath}`);
  
  try {
    let content = fs.readFileSync(fullPath, 'utf8');
    let hasChanges = false;
    
    // Fix fetchFromTable signatures: fetchFromTable('table', options) → fetchFromTable({table, ...options})
    const fetchFromTableOldPattern = /await\s+fetchFromTable\s*\(\s*['"`]([^'"`]+)['"`]\s*,\s*\{/g;
    const fetchFromTableMatches = content.match(fetchFromTableOldPattern);
    
    if (fetchFromTableMatches) {
      console.log(`  → Fixing ${fetchFromTableMatches.length} fetchFromTable calls`);
      content = content.replace(
        /await\s+fetchFromTable\s*\(\s*['"`]([^'"`]+)['"`]\s*,\s*\{/g,
        "await fetchFromTable({\n        table: '$1',"
      );
      hasChanges = true;
    }
    
    // Fix insertIntoTable signatures: insertIntoTable('table', data) → insertIntoTable({table, data})
    const insertIntoTableOldPattern = /await\s+insertIntoTable\s*\(\s*['"`]([^'"`]+)['"`]\s*,\s*([^)]+)\)/g;
    const insertIntoTableMatches = content.match(insertIntoTableOldPattern);
    
    if (insertIntoTableMatches) {
      console.log(`  → Fixing ${insertIntoTableMatches.length} insertIntoTable calls`);
      content = content.replace(
        /await\s+insertIntoTable\s*\(\s*['"`]([^'"`]+)['"`]\s*,\s*([^)]+)\)/g,
        "await insertIntoTable({\n        table: '$1',\n        data: $2\n      })"
      );
      hasChanges = true;
    }
    
    // Fix updateTable signatures: updateTable('table', {data}, {filters}) → updateTable({table, data, filters})
    const updateTableOldPattern = /await\s+updateTable\s*\(\s*['"`]([^'"`]+)['"`]\s*,/g;
    const updateTableMatches = content.match(updateTableOldPattern);
    
    if (updateTableMatches) {
      console.log(`  → Fixing ${updateTableMatches.length} updateTable calls`);
      // Plus complexe car updateTable a 3 arguments, on va faire une approche plus conservatrice
      content = content.replace(
        /await\s+updateTable\s*\(\s*['"`]([^'"`]+)['"`]\s*,\s*\{/g,
        "await updateTable({\n        table: '$1',\n        data: {"
      );
      hasChanges = true;
    }
    
    // Fix deleteFromTable signatures: deleteFromTable('table', filters) → deleteFromTable({table, filters})
    const deleteFromTableOldPattern = /await\s+deleteFromTable\s*\(\s*['"`]([^'"`]+)['"`]\s*,/g;
    const deleteFromTableMatches = content.match(deleteFromTableOldPattern);
    
    if (deleteFromTableMatches) {
      console.log(`  → Fixing ${deleteFromTableMatches.length} deleteFromTable calls`);
      content = content.replace(
        /await\s+deleteFromTable\s*\(\s*['"`]([^'"`]+)['"`]\s*,\s*\{/g,
        "await deleteFromTable({\n        table: '$1',\n        filters: {"
      );
      hasChanges = true;
    }
    
    if (hasChanges) {
      fs.writeFileSync(fullPath, content, 'utf8');
      console.log(`  ✅ Successfully fixed: ${filePath}`);
    } else {
      console.log(`  ⏭️  No signature issues found in: ${filePath}`);
    }
    
  } catch (error) {
    console.error(`  ❌ Error fixing ${filePath}:`, error.message);
  }
}

// Fonction pour corriger next.config.ts
function fixNextConfig() {
  const nextConfigPath = path.join(__dirname, 'next.config.ts');
  
  if (!fs.existsSync(nextConfigPath)) {
    console.log(`⚠️  next.config.ts not found`);
    return;
  }
  
  console.log(`🔧 Fixing: next.config.ts`);
  
  try {
    let content = fs.readFileSync(nextConfigPath, 'utf8');
    
    // Fix deprecated serverComponentsExternalPackages
    if (content.includes('serverComponentsExternalPackages')) {
      content = content.replace(
        /experimental:\s*\{\s*serverComponentsExternalPackages:\s*\[([^\]]+)\]\s*\}/,
        'serverExternalPackages: [$1]'
      );
      
      fs.writeFileSync(nextConfigPath, content, 'utf8');
      console.log(`  ✅ Fixed next.config.ts deprecation warning`);
    } else {
      console.log(`  ⏭️  No deprecation issues in next.config.ts`);
    }
    
  } catch (error) {
    console.error(`  ❌ Error fixing next.config.ts:`, error.message);
  }
}

// Fonction principale
function main() {
  console.log('🚀 Fixing ALL function signature and configuration issues...\n');
  
  console.log('📁 Fixing Next.js configuration...');
  fixNextConfig();
  
  console.log('\n📁 Fixing function signatures in all files...');
  filesToFix.forEach(fixFileSignatures);
  
  console.log('\n✅ Systematic fixes completed!');
  console.log('\n🎯 Next steps:');
  console.log('1. Run: npm run build');
  console.log('2. If successful, apply PostgreSQL migrations');
  console.log('3. Test the application');
}

// Exécuter le script
main();
