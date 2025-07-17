'use client'
import { useState } from 'react'
import ProjectSelection from '../components/ProjectSelection'
import AgentSelection from '../components/AgentSelection'
import Dashboard from '../components/Dashboard'

export default function Home() {
  const [currentView, setCurrentView] = useState('projects')
  const [selectedProject, setSelectedProject] = useState<any>(null)
  const [selectedAgent, setSelectedAgent] = useState<any>(null)

  const handleProjectSelect = (project: any) => {
    setSelectedProject(project)
    setCurrentView('agents')
  }

  const handleAgentSelect = (agent: any) => {
    setSelectedAgent(agent)
    setCurrentView('dashboard')
  }

  const handleBackToProjects = () => {
    setCurrentView('projects')
    setSelectedProject(null)
  }

  const handleBackToAgents = () => {
    setCurrentView('agents')
    setSelectedAgent(null)
  }

  switch (currentView) {
    case 'projects':
      return <ProjectSelection onProjectSelect={handleProjectSelect} />
    case 'agents':
      return (
        <AgentSelection 
          project={selectedProject} 
          onAgentSelect={handleAgentSelect}
          onBack={handleBackToProjects}
        />
      )
    case 'dashboard':
      return (
        <Dashboard 
          project={selectedProject}
          agent={selectedAgent}
          onBack={handleBackToAgents}
        />
      )
    default:
      return <ProjectSelection onProjectSelect={handleProjectSelect} />
  }
}