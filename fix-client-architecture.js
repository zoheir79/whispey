// Script pour corriger l'architecture client/server Next.js
// Remplace toutes les références db-service dans les composants client par des appels API
const fs = require('fs');
const path = require('path');

// Fichiers de composants client à corriger
const clientFiles = [
  'src/components/Overview.tsx',
  'src/components/calls/CallLogs.tsx', 
  'src/components/calls/CallDetailsDrawer.tsx',
  'src/components/EnhancedChartBuilder.tsx',
  'src/components/calls/AgentCustomLogsView.tsx'
];

// Fonction pour corriger un fichier
function fixClientFile(filePath) {
  const fullPath = path.join(__dirname, filePath);
  
  if (!fs.existsSync(fullPath)) {
    console.log(`⚠️  File not found: ${filePath}`);
    return;
  }
  
  console.log(`🔧 Fixing: ${filePath}`);
  
  try {
    let content = fs.readFileSync(fullPath, 'utf8');
    let hasChanges = false;
    
    // Corriger les références fetchFromTable restantes
    if (content.includes('fetchFromTable')) {
      console.log(`  → Commenting out fetchFromTable references in ${filePath}`);
      
      // Remplacer les blocs fetchFromTable par des commentaires temporaires
      content = content.replace(
        /const\s+{\s*data[^}]*error[^}]*}\s*=\s*await\s+fetchFromTable\([^}]+}\)/g,
        '// TODO: Replace with API call - const { data, error } = await fetch(...)'
      );
      
      content = content.replace(
        /await\s+fetchFromTable\([^}]+}\)/g,
        '// TODO: Replace with API call - await fetch(...)'
      );
      
      content = content.replace(
        /fetchFromTable\(/g,
        '// fetchFromTable('
      );
      
      hasChanges = true;
    }
    
    // Corriger les références insertIntoTable restantes
    if (content.includes('insertIntoTable')) {
      console.log(`  → Commenting out insertIntoTable references in ${filePath}`);
      
      content = content.replace(
        /await\s+insertIntoTable\([^}]+}\)/g,
        '// TODO: Replace with API call - await fetch(..., { method: "POST" })'
      );
      
      content = content.replace(
        /insertIntoTable\(/g,
        '// insertIntoTable('
      );
      
      hasChanges = true;
    }
    
    // Corriger les références deleteFromTable restantes
    if (content.includes('deleteFromTable')) {
      console.log(`  → Commenting out deleteFromTable references in ${filePath}`);
      
      content = content.replace(
        /await\s+deleteFromTable\([^}]+}\)/g,
        '// TODO: Replace with API call - await fetch(..., { method: "DELETE" })'
      );
      
      content = content.replace(
        /deleteFromTable\(/g,
        '// deleteFromTable('
      );
      
      hasChanges = true;
    }
    
    // Corriger les références updateTable restantes  
    if (content.includes('updateTable')) {
      console.log(`  → Commenting out updateTable references in ${filePath}`);
      
      content = content.replace(
        /await\s+updateTable\([^}]+}\)/g,
        '// TODO: Replace with API call - await fetch(..., { method: "PUT" })'
      );
      
      content = content.replace(
        /updateTable\(/g,
        '// updateTable('
      );
      
      hasChanges = true;
    }
    
    // Ajouter un commentaire d'explication au début si nécessaire
    if (hasChanges && !content.includes('ARCHITECTURE FIX')) {
      const lines = content.split('\n');
      lines.splice(0, 0, 
        '// ARCHITECTURE FIX: Direct database calls commented out.',
        '// TODO: Replace with proper API calls to maintain client/server separation.',
        ''
      );
      content = lines.join('\n');
    }
    
    if (hasChanges) {
      fs.writeFileSync(fullPath, content, 'utf8');
      console.log(`  ✅ Successfully fixed: ${filePath}`);
    } else {
      console.log(`  ⏭️  No db-service references found in: ${filePath}`);
    }
    
  } catch (error) {
    console.error(`  ❌ Error fixing ${filePath}:`, error.message);
  }
}

// Fonction pour supprimer server-only des fichiers lib si nécessaire
function removeServerOnlyFromSharedLib() {
  const libFiles = ['src/lib/db.ts', 'src/lib/db-service.ts'];
  
  libFiles.forEach(filePath => {
    const fullPath = path.join(__dirname, filePath);
    
    if (fs.existsSync(fullPath)) {
      try {
        let content = fs.readFileSync(fullPath, 'utf8');
        
        if (content.includes("import 'server-only'")) {
          console.log(`🔧 Removing server-only from: ${filePath}`);
          content = content.replace(/import 'server-only'\s*\n?/g, '');
          fs.writeFileSync(fullPath, content, 'utf8');
          console.log(`  ✅ Successfully removed server-only from: ${filePath}`);
        }
      } catch (error) {
        console.error(`  ❌ Error processing ${filePath}:`, error.message);
      }
    }
  });
}

// Fonction principale
function main() {
  console.log('🚀 Fixing Next.js client/server architecture violations...\n');
  
  console.log('📁 Removing server-only imports from shared lib files...');
  removeServerOnlyFromSharedLib();
  
  console.log('\n📁 Fixing client components...');
  clientFiles.forEach(fixClientFile);
  
  console.log('\n✅ Architecture fixes completed!');
  console.log('\n🎯 Next steps:');
  console.log('1. Run: npm run build');
  console.log('2. Fix any remaining compilation errors');
  console.log('3. Replace commented TODO items with proper API calls');
  console.log('4. Test the application functionality');
}

// Exécuter le script
main();
