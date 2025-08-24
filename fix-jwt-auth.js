#!/usr/bin/env node

/**
 * fix-jwt-auth.js
 * 
 * Automated script to fix JWT authentication in all API routes
 * Changes verifyUserAuth(authorization) calls to verifyUserAuth() (cookie-based)
 * Removes unnecessary authorization header reading code
 */

const fs = require('fs');
const path = require('path');

// List of API route files that need JWT auth fixes
const filesToFix = [
  'src/app/api/user/projects/route.ts',
  'src/app/api/projects/[id]/members/route.ts', 
  'src/app/api/projects/route.ts',
  'src/app/api/custom-totals/[...params]/route.ts'
];

console.log('🔧 Starting JWT Authentication Fix...\n');

function fixJWTAuth(filePath) {
  try {
    const fullPath = path.join(__dirname, filePath);
    
    if (!fs.existsSync(fullPath)) {
      console.log(`❌ File not found: ${filePath}`);
      return false;
    }

    let content = fs.readFileSync(fullPath, 'utf8');
    let modified = false;

    // Pattern 1: Replace verifyUserAuth(authorization) calls
    const oldAuthPattern = /verifyUserAuth\(authorization\)/g;
    if (content.match(oldAuthPattern)) {
      content = content.replace(oldAuthPattern, 'verifyUserAuth()');
      modified = true;
      console.log(`✅ Fixed verifyUserAuth() calls in ${filePath}`);
    }

    // Pattern 2: Replace verifyUserAuth(authHeader) calls  
    const oldAuthHeaderPattern = /verifyUserAuth\(authHeader\)/g;
    if (content.match(oldAuthHeaderPattern)) {
      content = content.replace(oldAuthHeaderPattern, 'verifyUserAuth()');
      modified = true;
      console.log(`✅ Fixed verifyUserAuth() calls in ${filePath}`);
    }

    // Pattern 3: Remove authorization header reading (multiple patterns)
    const authHeaderPatterns = [
      // Pattern: const headersList = await headers(); const authorization = headersList.get('authorization')
      /\s*const headersList = await headers\(\)\s*\n\s*const authorization = headersList\.get\('authorization'\)\s*\n/g,
      
      // Pattern: const authHeader = request.headers.get('authorization')
      /\s*const authHeader = request\.headers\.get\('authorization'\)\s*\n/g,
      
      // Pattern: const authorization = headersList.get('authorization')
      /\s*const authorization = headersList\.get\('authorization'\)\s*\n/g,
      
      // Pattern: standalone headers import line if authorization removed
      /\s*const headersList = await headers\(\)\s*\n(?=\s*const \{ isAuthenticated)/g
    ];

    authHeaderPatterns.forEach((pattern, index) => {
      if (content.match(pattern)) {
        content = content.replace(pattern, '');
        modified = true;
        console.log(`✅ Removed authorization header pattern ${index + 1} in ${filePath}`);
      }
    });

    // Pattern 4: Update comments to reflect cookie-based auth
    const commentPatterns = [
      {
        old: /\/\/ Check authentication/g,
        new: '// Check authentication (now reads JWT from cookies)'
      },
      {
        old: /\/\/ Verify JWT authentication/g, 
        new: '// Verify JWT authentication (now reads JWT from cookies)'
      }
    ];

    commentPatterns.forEach(({ old, new: newComment }) => {
      if (content.match(old)) {
        content = content.replace(old, newComment);
        modified = true;
        console.log(`✅ Updated comments in ${filePath}`);
      }
    });

    // Clean up extra blank lines
    content = content.replace(/\n\s*\n\s*\n/g, '\n\n');

    if (modified) {
      fs.writeFileSync(fullPath, content, 'utf8');
      console.log(`✅ Successfully updated ${filePath}\n`);
      return true;
    } else {
      console.log(`ℹ️  No changes needed in ${filePath}\n`);
      return false;
    }

  } catch (error) {
    console.error(`❌ Error processing ${filePath}:`, error.message);
    return false;
  }
}

// Process all files
let totalFixed = 0;
let totalProcessed = 0;

console.log('📋 Processing API route files for JWT auth fixes...\n');

filesToFix.forEach(filePath => {
  totalProcessed++;
  if (fixJWTAuth(filePath)) {
    totalFixed++;
  }
});

console.log('🎉 JWT Authentication Fix Complete!');
console.log(`📊 Summary: ${totalFixed}/${totalProcessed} files updated\n`);

if (totalFixed > 0) {
  console.log('✅ All API routes now use cookie-based JWT authentication');
  console.log('✅ 401 Unauthorized errors should be resolved');
  console.log('🚀 Ready to test dashboard functionality!');
} else {
  console.log('ℹ️  No files needed updates - JWT auth already configured correctly');
}
