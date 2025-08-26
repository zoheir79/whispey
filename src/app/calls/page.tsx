'use client';

import React, { useEffect, useState } from 'react';
import { Phone, Play, Clock, Calendar, User, FileText } from 'lucide-react';
import { useGlobalRole } from '@/hooks/useGlobalRole';

interface Call {
  id: string;
  call_id: string;
  project_id: string;
  project_name?: string;
  agent_name?: string;
  duration_seconds: number;
  status?: string;
  created_at: string;
  updated_at: string;
  has_transcript: boolean;
}

export default function CallsPage() {
  const [calls, setCalls] = useState<Call[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { globalRole, permissions, isLoading: roleLoading } = useGlobalRole();

  useEffect(() => {
    const fetchCalls = async () => {
      try {
        // For now, we'll fetch from a simple API that returns call logs
        const response = await fetch('/api/logs/transcript?limit=50');
        if (!response.ok) {
          throw new Error('Failed to fetch calls');
        }
        
        // Since we don't have a dedicated calls API yet, we'll simulate the data structure
        // In a real implementation, you'd have a dedicated /api/calls endpoint
        const data = await response.json();
        
        // Transform the response to match our Call interface
        const transformedCalls: Call[] = []; // We'll populate this when we have real data
        setCalls(transformedCalls);
      } catch (err: any) {
        console.log('Error fetching calls:', err.message);
        // For now, show empty state instead of error since this is expected
        setCalls([]);
      } finally {
        setLoading(false);
      }
    };

    if (!roleLoading) {
      fetchCalls();
    }
  }, [roleLoading]);

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (loading || roleLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading calls...</p>
        </div>
      </div>
    );
  }

  const pageTitle = permissions?.canViewAllCalls ? 'All Calls' : 'My Calls';

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
                <Phone className="w-8 h-8 text-purple-600" />
                {pageTitle}
              </h1>
              <p className="mt-2 text-gray-600">
                {permissions?.canViewAllCalls 
                  ? `View all call records across all workspaces (${calls.length} total)`
                  : `View your call records (${calls.length} total)`
                }
              </p>
            </div>
            
            {/* Global Role Badge */}
            {globalRole && globalRole !== 'user' && (
              <div className="bg-purple-100 text-purple-800 px-3 py-1 rounded-full text-sm font-medium">
                {globalRole.replace('_', ' ').toUpperCase()}
              </div>
            )}
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center gap-3">
              <Phone className="w-8 h-8 text-purple-600" />
              <div>
                <h3 className="text-2xl font-bold text-gray-900">{calls.length}</h3>
                <p className="text-gray-600">Total Calls</p>
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center gap-3">
              <Clock className="w-8 h-8 text-green-600" />
              <div>
                <h3 className="text-2xl font-bold text-gray-900">
                  {calls.reduce((total, call) => total + call.duration_seconds, 0) > 0 
                    ? formatDuration(calls.reduce((total, call) => total + call.duration_seconds, 0))
                    : '0:00'
                  }
                </h3>
                <p className="text-gray-600">Total Duration</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center gap-3">
              <FileText className="w-8 h-8 text-blue-600" />
              <div>
                <h3 className="text-2xl font-bold text-gray-900">
                  {calls.filter(call => call.has_transcript).length}
                </h3>
                <p className="text-gray-600">With Transcript</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center gap-3">
              <Calendar className="w-8 h-8 text-orange-600" />
              <div>
                <h3 className="text-2xl font-bold text-gray-900">
                  {calls.filter(call => {
                    const today = new Date();
                    const callDate = new Date(call.created_at);
                    return callDate.toDateString() === today.toDateString();
                  }).length}
                </h3>
                <p className="text-gray-600">Today</p>
              </div>
            </div>
          </div>
        </div>

        {/* Calls List */}
        {calls.length === 0 ? (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
            <Phone className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No calls found</h3>
            <p className="text-gray-600 mb-6">
              {permissions?.canViewAllCalls 
                ? 'No calls have been made yet across any workspace.'
                : 'You don\'t have access to any call records yet.'
              }
            </p>
            <div className="bg-blue-50 rounded-lg p-4">
              <p className="text-sm text-blue-800">
                <strong>Note:</strong> This page will display call records once the calls API is fully implemented.
                For now, you can view individual call transcripts through the dashboard.
              </p>
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-medium text-gray-900">Recent Calls</h2>
            </div>
            
            <div className="divide-y divide-gray-200">
              {calls.map((call) => (
                <div key={call.id} className="px-6 py-4 hover:bg-gray-50 transition-colors duration-200">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center">
                        <Phone className="w-5 h-5 text-purple-600" />
                      </div>
                      
                      <div>
                        <h3 className="font-medium text-gray-900">
                          Call {call.call_id.slice(0, 8)}...
                        </h3>
                        <div className="flex items-center gap-4 mt-1 text-sm text-gray-500">
                          {call.agent_name && (
                            <span className="flex items-center gap-1">
                              <User className="w-4 h-4" />
                              {call.agent_name}
                            </span>
                          )}
                          {call.project_name && (
                            <span>Project: {call.project_name}</span>
                          )}
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-6 text-sm text-gray-500">
                      <div className="flex items-center gap-1">
                        <Clock className="w-4 h-4" />
                        {formatDuration(call.duration_seconds)}
                      </div>
                      
                      <div className="flex items-center gap-1">
                        <Calendar className="w-4 h-4" />
                        {new Date(call.created_at).toLocaleDateString()}
                      </div>
                      
                      {call.has_transcript && (
                        <div className="flex items-center gap-1 text-blue-600">
                          <FileText className="w-4 h-4" />
                          Transcript
                        </div>
                      )}
                      
                      <button className="bg-purple-50 hover:bg-purple-100 text-purple-700 px-3 py-1 rounded-md font-medium transition-colors duration-200">
                        View
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
