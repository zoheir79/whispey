/**
 * Test script pour vérifier le système de suspension/réactivation des workspaces
 * 
 * Usage: node test-workspace-suspension.js
 * 
 * Ce script teste:
 * 1. Récupération du statut d'un workspace
 * 2. Suspension d'un workspace
 * 3. Réactivation d'un workspace
 */

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'

// Configuration du test
const TEST_CONFIG = {
  workspaceId: process.env.TEST_WORKSPACE_ID || 'test-workspace-id',
  authToken: process.env.TEST_AUTH_TOKEN || '', // JWT token pour authentification
  testSuspensionReason: 'Test de suspension automatisé'
}

/**
 * Fonction utilitaire pour faire des requêtes API
 */
async function apiRequest(endpoint, options = {}) {
  const url = `${BASE_URL}${endpoint}`
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${TEST_CONFIG.authToken}`,
    ...options.headers
  }

  console.log(`🔄 ${options.method || 'GET'} ${url}`)
  
  try {
    const response = await fetch(url, {
      ...options,
      headers
    })

    const data = await response.json()
    
    console.log(`📊 Status: ${response.status}`)
    console.log(`📝 Response:`, JSON.stringify(data, null, 2))
    
    return { response, data }
  } catch (error) {
    console.error(`❌ Error calling ${url}:`, error.message)
    return { error }
  }
}

/**
 * Test 1: Récupérer le statut actuel du workspace
 */
async function testGetWorkspaceStatus() {
  console.log(`\n🔍 TEST 1: Récupération du statut du workspace ${TEST_CONFIG.workspaceId}`)
  
  const { response, data, error } = await apiRequest(
    `/api/workspace/${TEST_CONFIG.workspaceId}/suspend`
  )

  if (error) {
    console.log('❌ Erreur lors de la récupération du statut')
    return null
  }

  if (response.status === 200) {
    console.log('✅ Statut récupéré avec succès')
    return data.workspace
  } else {
    console.log(`❌ Erreur ${response.status}: ${data.error}`)
    return null
  }
}

/**
 * Test 2: Suspendre le workspace
 */
async function testSuspendWorkspace() {
  console.log(`\n⏸️ TEST 2: Suspension du workspace ${TEST_CONFIG.workspaceId}`)
  
  const { response, data, error } = await apiRequest(
    `/api/workspace/${TEST_CONFIG.workspaceId}/suspend`,
    {
      method: 'POST',
      body: JSON.stringify({
        suspension_reason: TEST_CONFIG.testSuspensionReason,
        suspend_agents: true,
        suspend_kb: true,
        suspend_workflows: true,
        auto_suspension: false
      })
    }
  )

  if (error) {
    console.log('❌ Erreur lors de la suspension')
    return false
  }

  if (response.status === 200) {
    console.log('✅ Workspace suspendu avec succès')
    console.log(`📦 Services suspendus:`, data.suspended_services)
    return true
  } else {
    console.log(`❌ Erreur ${response.status}: ${data.error}`)
    return false
  }
}

/**
 * Test 3: Réactiver le workspace
 */
async function testReactivateWorkspace() {
  console.log(`\n▶️ TEST 3: Réactivation du workspace ${TEST_CONFIG.workspaceId}`)
  
  const { response, data, error } = await apiRequest(
    `/api/workspace/${TEST_CONFIG.workspaceId}/suspend`,
    {
      method: 'DELETE'
    }
  )

  if (error) {
    console.log('❌ Erreur lors de la réactivation')
    return false
  }

  if (response.status === 200) {
    console.log('✅ Workspace réactivé avec succès')
    console.log(`📦 Services réactivés:`, data.reactivated_services)
    return true
  } else {
    console.log(`❌ Erreur ${response.status}: ${data.error}`)
    return false
  }
}

/**
 * Test 4: Vérifier le statut après réactivation
 */
async function testStatusAfterReactivation() {
  console.log(`\n🔄 TEST 4: Vérification du statut après réactivation`)
  
  const workspace = await testGetWorkspaceStatus()
  
  if (workspace) {
    if (!workspace.is_suspended) {
      console.log('✅ Workspace correctement réactivé')
      return true
    } else {
      console.log('❌ Workspace encore suspendu après réactivation')
      return false
    }
  }
  
  return false
}

/**
 * Test principal
 */
async function runTests() {
  console.log('🚀 DÉMARRAGE DES TESTS DE SUSPENSION/RÉACTIVATION')
  console.log('=' * 60)
  
  // Vérification de la configuration
  if (!TEST_CONFIG.workspaceId || !TEST_CONFIG.authToken) {
    console.log('❌ Configuration manquante:')
    console.log('   - TEST_WORKSPACE_ID:', TEST_CONFIG.workspaceId ? '✅' : '❌')
    console.log('   - TEST_AUTH_TOKEN:', TEST_CONFIG.authToken ? '✅' : '❌')
    console.log('\nVeuillez définir les variables d\'environnement nécessaires.')
    return
  }

  let testResults = {
    getStatus: false,
    suspend: false,
    reactivate: false,
    finalStatus: false
  }

  try {
    // Test 1: Statut initial
    const initialWorkspace = await testGetWorkspaceStatus()
    testResults.getStatus = !!initialWorkspace
    
    if (!testResults.getStatus) {
      console.log('❌ Impossible de continuer sans accès au workspace')
      return
    }

    console.log(`📋 Statut initial: ${initialWorkspace.is_suspended ? 'SUSPENDU' : 'ACTIF'}`)

    // Si déjà suspendu, on réactive d'abord
    if (initialWorkspace.is_suspended) {
      console.log('⚠️ Workspace déjà suspendu, réactivation d\'abord...')
      await testReactivateWorkspace()
      await new Promise(resolve => setTimeout(resolve, 1000)) // Attendre 1s
    }

    // Test 2: Suspension
    testResults.suspend = await testSuspendWorkspace()
    if (testResults.suspend) {
      await new Promise(resolve => setTimeout(resolve, 2000)) // Attendre 2s pour la propagation
    }

    // Test 3: Réactivation
    testResults.reactivate = await testReactivateWorkspace()
    if (testResults.reactivate) {
      await new Promise(resolve => setTimeout(resolve, 2000)) // Attendre 2s pour la propagation
    }

    // Test 4: Vérification finale
    testResults.finalStatus = await testStatusAfterReactivation()

  } catch (error) {
    console.error('❌ Erreur durant les tests:', error.message)
  }

  // Résumé des résultats
  console.log('\n📊 RÉSUMÉ DES TESTS')
  console.log('=' * 30)
  console.log(`🔍 Récupération statut: ${testResults.getStatus ? '✅' : '❌'}`)
  console.log(`⏸️ Suspension: ${testResults.suspend ? '✅' : '❌'}`)
  console.log(`▶️ Réactivation: ${testResults.reactivate ? '✅' : '❌'}`)
  console.log(`🔄 Statut final: ${testResults.finalStatus ? '✅' : '❌'}`)
  
  const successCount = Object.values(testResults).filter(Boolean).length
  const totalTests = Object.keys(testResults).length
  
  console.log(`\n🎯 RÉSULTAT GLOBAL: ${successCount}/${totalTests} tests réussis`)
  
  if (successCount === totalTests) {
    console.log('🎉 Tous les tests sont passés avec succès!')
  } else {
    console.log('⚠️ Certains tests ont échoué. Vérifiez les logs ci-dessus.')
  }
}

// Exécution du script
if (require.main === module) {
  runTests().catch(console.error)
}

module.exports = {
  testGetWorkspaceStatus,
  testSuspendWorkspace, 
  testReactivateWorkspace,
  testStatusAfterReactivation,
  runTests
}
