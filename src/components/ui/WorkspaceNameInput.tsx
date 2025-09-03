'use client'

import React, { useState, useEffect } from 'react'
import { Input } from '@/components/ui/input'
import { useGlobalRole } from '@/hooks/useGlobalRole'

interface WorkspaceNameInputProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  className?: string
}

export default function WorkspaceNameInput({ 
  value, 
  onChange, 
  placeholder = "Enter workspace name",
  className = "mt-1" 
}: WorkspaceNameInputProps) {
  const { isAdmin } = useGlobalRole()
  const [editableValue, setEditableValue] = useState('')

  // Extract prefix (first 8 characters) and suffix (rest)
  const prefix = value.length >= 8 ? value.substring(0, 8) : ''
  const suffix = value.length >= 8 ? value.substring(8) : value

  // Initialize editable value
  useEffect(() => {
    if (isAdmin) {
      setEditableValue(value)
    } else {
      setEditableValue(suffix)
    }
  }, [value, isAdmin, suffix])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value

    if (isAdmin) {
      // Admin can edit full name
      setEditableValue(newValue)
      onChange(newValue)
    } else {
      // Regular user can only edit suffix part
      setEditableValue(newValue)
      onChange(prefix + newValue)
    }
  }

  if (isAdmin) {
    // Admin sees normal input for full name
    return (
      <Input
        value={editableValue}
        onChange={handleChange}
        placeholder={placeholder}
        className={className}
      />
    )
  }

  // Regular user sees prefix (readonly) + editable suffix
  return (
    <div className={`flex items-center ${className}`}>
      <div className="flex-1 flex">
        {/* Readonly prefix */}
        <div className="flex items-center bg-gray-50 dark:bg-gray-700 border border-r-0 border-gray-300 dark:border-gray-600 rounded-l-md px-3 py-2 text-sm text-gray-600 dark:text-gray-300 font-mono">
          {prefix}
        </div>
        {/* Editable suffix */}
        <Input
          value={editableValue}
          onChange={handleChange}
          placeholder="workspace-name"
          className="rounded-l-none border-l-0 focus:ring-offset-0"
        />
      </div>
    </div>
  )
}
