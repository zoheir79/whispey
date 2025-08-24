// Script automatisé pour ajouter "export const runtime = 'nodejs'" aux routes API
const fs = require('fs');
const path = require('path');

// Fonction pour traiter récursivement les fichiers
function processDirectory(dirPath) {
    const files = fs.readdirSync(dirPath);
    
    files.forEach(file => {
        const fullPath = path.join(dirPath, file);
        const stat = fs.statSync(fullPath);
        
        if (stat.isDirectory()) {
            processDirectory(fullPath);
        } else if (file.endsWith('route.ts') || file.endsWith('route.tsx')) {
            processRouteFile(fullPath);
        }
    });
}

// Fonction pour traiter un fichier de route
function processRouteFile(filePath) {
    console.log(`Processing: ${filePath}`);
    
    try {
        const content = fs.readFileSync(filePath, 'utf8');
        
        // Vérifier si le fichier contient des imports problématiques
        const needsNodeRuntime = (
            content.includes('from \'@/lib/db-service\'') ||
            content.includes('from \'../../../../lib/db-service\'') ||
            content.includes('from \'../../../lib/db-service\'') ||
            content.includes('from \'../../lib/db-service\'') ||
            content.includes('from \'@/lib/auth\'') ||
            content.includes('from \'../../../../lib/auth\'') ||
            content.includes('from \'../../../lib/auth\'') ||
            content.includes('from \'../../lib/auth\'') ||
            content.includes('from \'@/lib/auth-utils\'') ||
            content.includes('bcryptjs') ||
            content.includes('jsonwebtoken') ||
            content.includes('pg') ||
            content.includes('postgresql')
        );
        
        // Vérifier si runtime est déjà défini
        const hasRuntime = content.includes('export const runtime');
        
        if (needsNodeRuntime && !hasRuntime) {
            console.log(`  → Adding Node.js runtime to: ${filePath}`);
            
            // Trouver où insérer la directive runtime
            const lines = content.split('\n');
            let insertIndex = -1;
            
            // Chercher après les imports
            for (let i = 0; i < lines.length; i++) {
                const line = lines[i].trim();
                
                // Si on trouve une ligne qui n'est pas un import, commentaire ou ligne vide
                if (line && 
                    !line.startsWith('import ') && 
                    !line.startsWith('//') && 
                    !line.startsWith('/*') && 
                    !line.startsWith('*') && 
                    !line.startsWith('*/') &&
                    line !== '') {
                    insertIndex = i;
                    break;
                }
            }
            
            if (insertIndex === -1) {
                // Si on ne trouve pas d'endroit approprié, insérer après les imports
                for (let i = lines.length - 1; i >= 0; i--) {
                    if (lines[i].trim().startsWith('import ')) {
                        insertIndex = i + 1;
                        break;
                    }
                }
            }
            
            if (insertIndex !== -1) {
                // Insérer la directive runtime
                lines.splice(insertIndex, 0, '', '// Force Node.js runtime for PostgreSQL/JWT compatibility', 'export const runtime = \'nodejs\'');
                
                const newContent = lines.join('\n');
                fs.writeFileSync(filePath, newContent, 'utf8');
                console.log(`  ✅ Successfully updated: ${filePath}`);
            } else {
                console.log(`  ⚠️  Could not find insertion point in: ${filePath}`);
            }
        } else if (hasRuntime) {
            console.log(`  ⏭️  Runtime already defined in: ${filePath}`);
        } else {
            console.log(`  ⏭️  No Node.js modules detected in: ${filePath}`);
        }
    } catch (error) {
        console.error(`  ❌ Error processing ${filePath}:`, error.message);
    }
}

// Traiter également les fichiers lib qui pourraient être importés côté client
function processLibFile(filePath) {
    try {
        const content = fs.readFileSync(filePath, 'utf8');
        
        const needsServerOnly = (
            content.includes('pg') ||
            content.includes('bcryptjs') ||
            content.includes('jsonwebtoken')
        );
        
        const hasServerOnly = content.includes('import \'server-only\'');
        
        if (needsServerOnly && !hasServerOnly) {
            console.log(`  → Adding server-only import to: ${filePath}`);
            
            const lines = content.split('\n');
            
            // Ajouter server-only en premier import
            if (lines[0].trim().startsWith('import ')) {
                lines.unshift('import \'server-only\'');
            } else {
                lines.unshift('import \'server-only\'', '');
            }
            
            const newContent = lines.join('\n');
            fs.writeFileSync(filePath, newContent, 'utf8');
            console.log(`  ✅ Successfully updated: ${filePath}`);
        }
    } catch (error) {
        console.error(`  ❌ Error processing ${filePath}:`, error.message);
    }
}

// Fonction principale
function main() {
    const apiDir = path.join(__dirname, 'src', 'app', 'api');
    const libDir = path.join(__dirname, 'src', 'lib');
    
    console.log('🚀 Fixing Next.js Edge Runtime compatibility issues...\n');
    
    console.log('📁 Processing API routes...');
    processDirectory(apiDir);
    
    console.log('\n📁 Processing lib files...');
    const libFiles = ['db-service.ts', 'auth.ts', 'auth-utils.ts', 'db.ts', 'db-rpc.ts'];
    
    libFiles.forEach(file => {
        const fullPath = path.join(libDir, file);
        if (fs.existsSync(fullPath)) {
            console.log(`Processing: ${fullPath}`);
            processLibFile(fullPath);
        }
    });
    
    console.log('\n✅ Runtime compatibility fixes completed!');
    console.log('\n🎯 Next steps:');
    console.log('1. Run: npm run build');
    console.log('2. Test the application');
    console.log('3. Deploy if successful');
}

// Exécuter le script
main();
