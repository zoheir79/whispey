"use client"

import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { 
  Key, 
  Plus, 
  Trash2, 
  Copy, 
  Eye, 
  EyeOff, 
  AlertTriangle,
  CheckCircle,
  RefreshCw,
  Settings as SettingsIcon
} from 'lucide-react'
// Using native browser alerts instead of external toast library

interface Project {
  id: string
  name: string
  has_token: boolean
  created_at: string
  updated_at: string
}

interface APIKey {
  token: string
  projectId: string
  hint: string
}

export default function SettingsPage() {
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState<string | null>(null)
  const [newApiKey, setNewApiKey] = useState<APIKey | null>(null)
  const [showToken, setShowToken] = useState(false)

  // Load projects and API keys
  useEffect(() => {
    fetchProjects()
  }, [])

  const fetchProjects = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/api-keys')
      const data = await response.json()

      if (data.success) {
        setProjects(data.projects)
      } else {
        alert('❌ Erreur lors du chargement des projets')
      }
    } catch (error) {
      console.error('Error fetching projects:', error)
      alert('❌ Erreur de connexion')
    } finally {
      setLoading(false)
    }
  }

  const createAPIKey = async (projectId: string) => {
    try {
      setCreating(projectId)
      const response = await fetch('/api/api-keys', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ projectId })
      })

      const data = await response.json()

      if (data.success) {
        setNewApiKey({
          token: data.token,
          projectId: data.projectId,
          hint: data.hint
        })
        alert('✅ API key créée avec succès !')
        await fetchProjects() // Refresh the list
      } else {
        alert('❌ ' + (data.message || 'Erreur lors de la création'))
      }
    } catch (error) {
      console.error('Error creating API key:', error)
      toast.error('Erreur de connexion')
    } finally {
      setCreating(null)
    }
  }

  const revokeAPIKey = async (projectId: string) => {
    if (!confirm('Êtes-vous sûr de vouloir révoquer cette API key ? Cette action est irréversible.')) {
      return
    }

    try {
      const response = await fetch('/api/api-keys', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ projectId })
      })

      const data = await response.json()

      if (data.success) {
        alert('✅ API key révoquée avec succès')
        await fetchProjects() // Refresh the list
      } else {
        alert('❌ ' + (data.message || 'Erreur lors de la révocation'))
      }
    } catch (error) {
      console.error('Error revoking API key:', error)
      toast.error('Erreur de connexion')
    }
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    alert('📋 Token copié dans le presse-papiers !')
  }

  const closeNewKeyModal = () => {
    setNewApiKey(null)
    setShowToken(false)
  }

  if (loading) {
    return (
      <div className="container max-w-4xl mx-auto p-6">
        <div className="flex items-center space-x-2 mb-6">
          <SettingsIcon className="h-6 w-6" />
          <h1 className="text-2xl font-bold">Settings</h1>
        </div>
        <div className="flex justify-center py-12">
          <RefreshCw className="h-6 w-6 animate-spin" />
        </div>
      </div>
    )
  }

  return (
    <div className="container max-w-4xl mx-auto p-6">
      {/* Header */}
      <div className="flex items-center space-x-2 mb-6">
        <SettingsIcon className="h-6 w-6" />
        <h1 className="text-2xl font-bold">Settings</h1>
      </div>

      {/* API Keys Section */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Key className="h-5 w-5" />
            <span>API Keys</span>
          </CardTitle>
          <CardDescription>
            Gérez vos clés API pour accéder aux endpoints de Whispey de manière programmatique.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {projects.length === 0 ? (
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                Aucun projet trouvé. Créez d'abord un projet pour pouvoir générer des API keys.
              </AlertDescription>
            </Alert>
          ) : (
            <div className="space-y-4">
              {projects.map((project) => (
                <div
                  key={project.id}
                  className="flex items-center justify-between p-4 border rounded-lg"
                >
                  <div className="flex-1">
                    <div className="flex items-center space-x-3">
                      <h3 className="font-medium">{project.name}</h3>
                      {project.has_token ? (
                        <Badge variant="default" className="bg-green-100 text-green-800">
                          <CheckCircle className="h-3 w-3 mr-1" />
                          Token actif
                        </Badge>
                      ) : (
                        <Badge variant="secondary">
                          Pas de token
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-gray-500 mt-1">
                      Project ID: {project.id}
                    </p>
                    <p className="text-sm text-gray-500">
                      Créé le {new Date(project.created_at).toLocaleDateString('fr-FR')}
                    </p>
                  </div>
                  <div className="flex items-center space-x-2">
                    {project.has_token ? (
                      <>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => revokeAPIKey(project.id)}
                        >
                          <Trash2 className="h-4 w-4 mr-1" />
                          Révoquer
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => createAPIKey(project.id)}
                          disabled={creating === project.id}
                        >
                          {creating === project.id ? (
                            <RefreshCw className="h-4 w-4 mr-1 animate-spin" />
                          ) : (
                            <RefreshCw className="h-4 w-4 mr-1" />
                          )}
                          Régénérer
                        </Button>
                      </>
                    ) : (
                      <Button
                        onClick={() => createAPIKey(project.id)}
                        disabled={creating === project.id}
                        size="sm"
                      >
                        {creating === project.id ? (
                          <RefreshCw className="h-4 w-4 mr-1 animate-spin" />
                        ) : (
                          <Plus className="h-4 w-4 mr-1" />
                        )}
                        Créer Token
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Usage Instructions */}
      <Card>
        <CardHeader>
          <CardTitle>Utilisation des API Keys</CardTitle>
          <CardDescription>
            Comment utiliser vos API keys pour accéder aux endpoints Whispey
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <h4 className="font-medium mb-2">Headers requis :</h4>
            <pre className="bg-gray-100 p-3 rounded text-sm">
{`Content-Type: application/json
x-pype-token: VOTRE_API_KEY`}
            </pre>
          </div>
          <div>
            <h4 className="font-medium mb-2">Exemple d'appel :</h4>
            <pre className="bg-gray-100 p-3 rounded text-sm overflow-x-auto">
{`curl -X POST https://monvoice.adexgenie.ai/api/logs/call-logs \\
  -H "Content-Type: application/json" \\
  -H "x-pype-token: VOTRE_API_KEY" \\
  -d '{"call_id": "test", "agent_id": "PROJECT_ID"}'`}
            </pre>
          </div>
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              <strong>Important :</strong> Gardez vos API keys secrètes. Ne les partagez jamais publiquement et stockez-les de manière sécurisée.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>

      {/* New API Key Modal */}
      {newApiKey && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <Card className="w-full max-w-lg mx-4">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <CheckCircle className="h-5 w-5 text-green-600" />
                <span>API Key Créée !</span>
              </CardTitle>
              <CardDescription>
                {newApiKey.hint}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-medium">Votre nouvelle API Key :</label>
                <div className="flex items-center space-x-2 mt-1">
                  <Input
                    type={showToken ? "text" : "password"}
                    value={newApiKey.token}
                    readOnly
                    className="font-mono text-sm"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowToken(!showToken)}
                  >
                    {showToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => copyToClipboard(newApiKey.token)}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  Copiez cette clé maintenant ! Elle ne sera plus affichée pour des raisons de sécurité.
                </AlertDescription>
              </Alert>
              <div className="flex justify-end">
                <Button onClick={closeNewKeyModal}>
                  J'ai sauvegardé ma clé
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
