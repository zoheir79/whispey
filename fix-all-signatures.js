// Script COMPLET pour corriger TOUTES les signatures db-service dans TOUT le codebase
const fs = require('fs');
const path = require('path');

// Fonction pour scanner récursivement tous les fichiers TypeScript/JavaScript
function getAllTSFiles(dir, fileList = []) {
  const files = fs.readdirSync(dir);
  
  files.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    
    if (stat.isDirectory()) {
      // Ignorer node_modules et .next
      if (!['node_modules', '.next', '.git', 'dist', 'build'].includes(file)) {
        getAllTSFiles(filePath, fileList);
      }
    } else if (file.match(/\.(ts|tsx|js|jsx)$/)) {
      fileList.push(filePath);
    }
  });
  
  return fileList;
}

// Fonction pour corriger toutes les signatures dans un fichier
function fixAllSignaturesInFile(filePath) {
  try {
    let content = fs.readFileSync(filePath, 'utf8');
    let hasChanges = false;
    const relativePath = path.relative(__dirname, filePath);
    
    // Skip si le fichier ne contient pas d'appels db-service
    if (!content.includes('fetchFromTable') && 
        !content.includes('insertIntoTable') && 
        !content.includes('updateTable') && 
        !content.includes('deleteFromTable')) {
      return false;
    }
    
    console.log(`🔧 Checking: ${relativePath}`);
    
    // 1. Fix fetchFromTable: toutes les variations possibles
    const fetchPatterns = [
      // fetchFromTable('table', { ... })
      /(\s+)await\s+fetchFromTable\s*\(\s*['"`]([^'"`]+)['"`]\s*,\s*\{([^}]+(?:\{[^}]*\}[^}]*)*)\}\s*\)/g,
      // fetchFromTable("table", { ... })  avec des retours à la ligne
      /(\s+)await\s+fetchFromTable\s*\(\s*['"`]([^'"`]+)['"`]\s*,\s*\{([^}]+(?:\{[^}]*\}[^}]*)*)\}\s*\)/gs,
    ];
    
    fetchPatterns.forEach(pattern => {
      const matches = content.match(pattern);
      if (matches) {
        console.log(`  → Fixing ${matches.length} fetchFromTable calls`);
        content = content.replace(pattern, (match, indent, table, options) => {
          // Nettoyer les options en gardant la structure
          const cleanOptions = options.trim().replace(/\s+/g, ' ');
          return `${indent}await fetchFromTable({\n${indent}  table: '${table}',\n${indent}  ${cleanOptions}\n${indent}})`;
        });
        hasChanges = true;
      }
    });
    
    // 2. Fix insertIntoTable: toutes les variations
    const insertPatterns = [
      // insertIntoTable('table', data)
      /(\s+)await\s+insertIntoTable\s*\(\s*['"`]([^'"`]+)['"`]\s*,\s*([^)]+)\)/g,
      // avec map()
      /insertIntoTable\s*\(\s*['"`]([^'"`]+)['"`]\s*,\s*([^)]+)\)/g,
    ];
    
    insertPatterns.forEach((pattern, index) => {
      const matches = content.match(pattern);
      if (matches) {
        console.log(`  → Fixing ${matches.length} insertIntoTable calls (pattern ${index + 1})`);
        if (index === 0) {
          // Cas normal avec await
          content = content.replace(pattern, (match, indent, table, data) => {
            return `${indent}await insertIntoTable({\n${indent}  table: '${table}',\n${indent}  data: ${data.trim()}\n${indent}})`;
          });
        } else {
          // Cas dans map()
          content = content.replace(pattern, (match, table, data) => {
            return `insertIntoTable({ table: '${table}', data: ${data.trim()} })`;
          });
        }
        hasChanges = true;
      }
    });
    
    // 3. Fix updateTable: plus complexe car 3 arguments vers 1 objet
    const updatePatterns = [
      // updateTable('table', {data}, 'col', val) - old style
      /(\s+)await\s+updateTable\s*\(\s*\{\s*table:\s*['"`]([^'"`]+)['"`]\s*,\s*data:\s*\{([^}]+(?:\{[^}]*\}[^}]*)*)\}\s*,\s*filters:\s*\[([^\]]+(?:\[[^\]]*\][^\]]*)*)\]\s*\}\s*\)/gs,
    ];
    
    // Patterns pour l'ancienne signature
    const oldUpdatePatterns = [
      // await updateTable({ table: 'x', data: {...}, filters: [...] })  - already new format, skip
      // await updateTable('table', {...}, 'col', val) - need to convert
      /(\s+)await\s+updateTable\s*\(\s*['"`]([^'"`]+)['"`]\s*,\s*\{([^}]+(?:\{[^}]*\}[^}]*)*)\}\s*,\s*['"`]([^'"`]+)['"`]\s*,\s*([^)]+)\)/g,
    ];
    
    oldUpdatePatterns.forEach(pattern => {
      const matches = content.match(pattern);
      if (matches) {
        console.log(`  → Fixing ${matches.length} updateTable old-style calls`);
        content = content.replace(pattern, (match, indent, table, data, column, value) => {
          return `${indent}await updateTable({\n${indent}  table: '${table}',\n${indent}  data: {${data.trim()}},\n${indent}  filters: [{ column: '${column}', operator: 'eq', value: ${value.trim()} }]\n${indent}})`;
        });
        hasChanges = true;
      }
    });
    
    // 4. Fix deleteFromTable: simple conversion
    const deletePatterns = [
      // deleteFromTable('table', 'col', val)
      /(\s+)await\s+deleteFromTable\s*\(\s*['"`]([^'"`]+)['"`]\s*,\s*['"`]([^'"`]+)['"`]\s*,\s*([^)]+)\)/g,
    ];
    
    deletePatterns.forEach(pattern => {
      const matches = content.match(pattern);
      if (matches) {
        console.log(`  → Fixing ${matches.length} deleteFromTable calls`);
        content = content.replace(pattern, (match, indent, table, column, value) => {
          return `${indent}await deleteFromTable({\n${indent}  table: '${table}',\n${indent}  filters: [{ column: '${column}', operator: 'eq', value: ${value.trim()} }]\n${indent}})`;
        });
        hasChanges = true;
      }
    });
    
    // 5. Fix mixed patterns qui ont échappé aux corrections précédentes
    // Chercher toutes les signatures encore problématiques
    const remainingIssues = [
      // Anciens appels qui utilisent encore les vieilles signatures
      /await\s+(fetchFromTable|insertIntoTable|updateTable|deleteFromTable)\s*\(\s*['"`][^'"`]+['"`]\s*,/g
    ];
    
    remainingIssues.forEach(pattern => {
      const matches = content.match(pattern);
      if (matches) {
        console.log(`  ⚠️  Found ${matches.length} remaining old-style calls that need manual review`);
        matches.forEach(match => console.log(`    - ${match.trim()}`));
      }
    });
    
    if (hasChanges) {
      fs.writeFileSync(filePath, content, 'utf8');
      console.log(`  ✅ Fixed: ${relativePath}`);
      return true;
    } else {
      console.log(`  ⏭️  No issues: ${relativePath}`);
      return false;
    }
    
  } catch (error) {
    console.error(`  ❌ Error processing ${filePath}:`, error.message);
    return false;
  }
}

// Fonction pour corriger next.config.ts
function fixNextConfig() {
  const nextConfigPath = path.join(__dirname, 'next.config.ts');
  
  if (!fs.existsSync(nextConfigPath)) {
    console.log(`⚠️  next.config.ts not found`);
    return;
  }
  
  console.log(`🔧 Checking: next.config.ts`);
  
  try {
    let content = fs.readFileSync(nextConfigPath, 'utf8');
    
    // Fix deprecated serverComponentsExternalPackages
    if (content.includes('serverComponentsExternalPackages')) {
      content = content.replace(
        /experimental:\s*\{\s*serverComponentsExternalPackages:\s*\[([^\]]+)\]\s*\}/,
        'serverExternalPackages: [$1]'
      );
      
      fs.writeFileSync(nextConfigPath, content, 'utf8');
      console.log(`  ✅ Fixed next.config.ts deprecation`);
    } else {
      console.log(`  ⏭️  No issues in next.config.ts`);
    }
    
  } catch (error) {
    console.error(`  ❌ Error fixing next.config.ts:`, error.message);
  }
}

// Fonction principale
function main() {
  console.log('🚀 COMPREHENSIVE signature fixing for ALL files...\n');
  
  console.log('📁 Fixing Next.js configuration...');
  fixNextConfig();
  
  console.log('\n📁 Scanning ALL TypeScript/JavaScript files...');
  const allFiles = getAllTSFiles(path.join(__dirname, 'src'));
  console.log(`Found ${allFiles.length} files to check\n`);
  
  let totalFixed = 0;
  
  allFiles.forEach(file => {
    if (fixAllSignaturesInFile(file)) {
      totalFixed++;
    }
  });
  
  console.log(`\n✅ COMPREHENSIVE fixes completed!`);
  console.log(`📊 Summary: ${totalFixed} files were modified`);
  console.log('\n🎯 Next steps:');
  console.log('1. Run: npm run build');
  console.log('2. If successful, apply PostgreSQL migrations');
  console.log('3. Test the application');
}

// Exécuter le script
main();
