'use client'
import React from 'react'
import { ChevronRight, Folder, Settings, Loader2, AlertCircle } from 'lucide-react'
import { useSupabaseQuery } from '../../hooks/useSupabase'

interface Project {
  id: string
  name: string
  description: string
  environment: string
  created_at: string
  is_active: boolean
}

interface ProjectSelectionProps {
  onProjectSelect: (project: Project) => void
}

const ProjectSelection: React.FC<ProjectSelectionProps> = ({ onProjectSelect }) => {
  const { data: projects, loading, error } = useSupabaseQuery('pype_voice_projects', {
    select: 'id, name, description, environment, created_at, is_active',
    orderBy: { column: 'created_at', ascending: false },
    filters: [{ column: 'is_active', operator: 'eq', value: true }]
  })

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-900">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-900">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <p className="text-red-400">Error loading projects: {error}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <div className="border-b border-gray-800 px-6 py-4">
        <h1 className="text-2xl font-bold">Pype Voice Projects</h1>
        <p className="text-gray-400 mt-1">Select a project to view agents</p>
      </div>

      <div className="p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {projects?.map((project: Project) => (
            <div
              key={project.id}
              onClick={() => onProjectSelect(project)}
              className="bg-gray-800 rounded-lg p-6 border border-gray-700 hover:border-blue-500 transition-colors cursor-pointer group"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-600 rounded-lg">
                    <Folder className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-lg">{project.name}</h3>
                    <p className="text-gray-400 text-sm">{project.description}</p>
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-blue-500 transition-colors" />
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <span className={`px-2 py-1 text-xs rounded-full ${
                    project.environment === 'production' 
                      ? 'bg-green-100 text-green-800' 
                      : 'bg-yellow-100 text-yellow-800'
                  }`}>
                    {project.environment}
                  </span>
                  <span className="px-2 py-1 text-xs rounded-full bg-blue-100 text-blue-800">
                    Active
                  </span>
                </div>
                <button 
                  onClick={(e) => {
                    e.stopPropagation()
                    console.log('Settings for', project.name)
                  }}
                  className="p-1 hover:bg-gray-700 rounded"
                >
                  <Settings className="w-4 h-4 text-gray-400" />
                </button>
              </div>

              <div className="mt-4 pt-4 border-t border-gray-700">
                <p className="text-xs text-gray-500">
                  Created {new Date(project.created_at).toLocaleDateString()}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default ProjectSelection