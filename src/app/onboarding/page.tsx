'use client'

import React from 'react'
import { Clock, CheckCircle, Mail } from 'lucide-react'
import Header from '@/components/shared/Header'

export default function OnboardingPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <main className="max-w-2xl mx-auto px-8 py-16">
        <div className="text-center">
          <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <Clock className="w-8 h-8 text-blue-600" />
          </div>
          
          <h1 className="text-3xl font-bold text-gray-900 mb-4">
            Account Created Successfully!
          </h1>
          
          <p className="text-lg text-gray-600 mb-8">
            Your account has been created and is pending approval from an administrator.
          </p>
          
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-8 text-left">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">What happens next?</h2>
            
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-blue-600 text-sm font-bold">1</span>
                </div>
                <div>
                  <h3 className="font-medium text-gray-900">Account Review</h3>
                  <p className="text-sm text-gray-600">An administrator will review your account and assign appropriate permissions.</p>
                </div>
              </div>
              
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-blue-600 text-sm font-bold">2</span>
                </div>
                <div>
                  <h3 className="font-medium text-gray-900">Project Assignment</h3>
                  <p className="text-sm text-gray-600">You'll be added to relevant projects and workspaces based on your role.</p>
                </div>
              </div>
              
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-blue-600 text-sm font-bold">3</span>
                </div>
                <div>
                  <h3 className="font-medium text-gray-900">Email Notification</h3>
                  <p className="text-sm text-gray-600">You'll receive an email when your account is activated and ready to use.</p>
                </div>
              </div>
            </div>
          </div>
          
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-8">
            <div className="flex items-center gap-2 text-yellow-800 mb-2">
              <Mail className="w-5 h-5" />
              <h3 className="font-medium">Important</h3>
            </div>
            <p className="text-sm text-yellow-700">
              Please check your email regularly for updates about your account status. 
              If you don't hear back within 24-48 hours, please contact your system administrator.
            </p>
          </div>
          
          <div className="text-center">
            <p className="text-sm text-gray-500 mb-4">
              Need help? Contact your system administrator or IT support team.
            </p>
            
            <button 
              onClick={() => window.location.href = '/auth'}
              className="text-blue-600 hover:text-blue-700 font-medium text-sm"
            >
              ← Back to Sign In
            </button>
          </div>
        </div>
      </main>
    </div>
  )
}
