'use client';

import { useState } from 'react';
import Image from 'next/image';
import { Mic, Sparkles, Shield, Zap, Loader2 } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';

export default function AuthPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectUrl = searchParams.get('redirect') || '/dashboard';
  
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      const endpoint = isLogin ? '/api/auth/login' : '/api/auth/register';
      const payload = isLogin 
        ? { email, password } 
        : { email, password, firstName, lastName };

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Authentication failed');
      }

      // Set auth token in cookie
      document.cookie = `auth-token=${data.token}; path=/; max-age=${7 * 24 * 60 * 60}; SameSite=Strict`;

      // Redirect to dashboard after both login and signup
      router.push('/dashboard');
    } catch (err: any) {
      setError(err.message || 'Something went wrong');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white flex">
      {/* Left Side - Branding & Value Proposition */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 relative overflow-hidden">
        {/* Background Pattern */}
        <div className="absolute inset-0 opacity-20" style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fillRule='evenodd'%3E%3Cg fill='%23ffffff' fillOpacity='0.03'%3E%3Ccircle cx='30' cy='30' r='2'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`
        }}></div>
        
        <div className="relative z-10 flex flex-col justify-center px-12 py-16">
          <div className="max-w-md">
            {/* Logo */}
            <div className="flex items-center space-x-3 mb-12">
              <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center">
                <Image src="/logo.png" alt="Pype AI Logo" width={100} height={100} />
              </div>
              <span className="text-2xl font-bold text-white">Whispey</span>
            </div>

            {/* Value Proposition */}
            <h1 className="text-4xl font-bold text-white mb-6 leading-tight">
              Monitor your LiveKit Voice AI agents.
            </h1>
            
            <p className="text-slate-300 text-lg mb-12 leading-relaxed">
              Join hundreds of engineers and get complete observability into your Voice AI Applications.
            </p>

            {/* Features */}
            <div className="space-y-6">
              <div className="flex items-center space-x-4">
                <div className="w-10 h-10 bg-white/10 rounded-lg flex items-center justify-center">
                  <Sparkles className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="text-white font-semibold">Smart Transcription</h3>
                  <p className="text-slate-400 text-sm">Real-time voice-to-text with context awareness</p>
                </div>
              </div>
              
              <div className="flex items-center space-x-4">
                <div className="w-10 h-10 bg-white/10 rounded-lg flex items-center justify-center">
                  <Zap className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="text-white font-semibold">Instant Insights</h3>
                  <p className="text-slate-400 text-sm">AI-powered analysis and action items</p>
                </div>
              </div>
              
              <div className="flex items-center space-x-4">
                <div className="w-10 h-10 bg-white/10 rounded-lg flex items-center justify-center">
                  <Shield className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="text-white font-semibold">Completely Private</h3>
                  <p className="text-slate-400 text-sm">Open Source</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Right Side - Authentication */}
      <div className="flex-1 flex items-center justify-center px-6 py-12 lg:px-12">
        <div className="w-full max-w-md space-y-8">
          {/* Mobile Logo */}
          <div className="lg:hidden text-center">
            <div className="inline-flex items-center space-x-3 mb-8">
              <div className="w-12 h-12 bg-slate-900 rounded-xl flex items-center justify-center">
                <Mic className="w-6 h-6 text-white" />
              </div>
              <span className="text-2xl font-bold text-slate-900">Whispey</span>
            </div>
          </div>

          {/* Header */}
          <div className="text-center lg:text-left">
            <h2 className="text-3xl font-bold text-slate-900 mb-2">
              {isLogin ? 'Welcome back' : 'Create an account'}
            </h2>
            <p className="text-slate-600">
              {isLogin ? 'Sign in to your account to continue' : 'Get started with Whispey'}
            </p>
          </div>

          {/* Custom Auth Form */}
          <div className="mt-8">
            <form onSubmit={handleSubmit} className="space-y-6">
              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                  {error}
                </div>
              )}
              
              <div className="space-y-4">
                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-slate-700 mb-1">
                    Email address
                  </label>
                  <input
                    id="email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full border-2 border-slate-200 focus:ring-2 focus:ring-slate-900 focus:border-slate-900 rounded-lg py-3 px-4 transition-all duration-200 ease-in-out"
                  />
                </div>

                <div>
                  <label htmlFor="password" className="block text-sm font-medium text-slate-700 mb-1">
                    Password
                  </label>
                  <input
                    id="password"
                    name="password"
                    type="password"
                    autoComplete={isLogin ? 'current-password' : 'new-password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full border-2 border-slate-200 focus:ring-2 focus:ring-slate-900 focus:border-slate-900 rounded-lg py-3 px-4 transition-all duration-200 ease-in-out"
                  />
                </div>

                {!isLogin && (
                  <>
                    <div>
                      <label htmlFor="firstName" className="block text-sm font-medium text-slate-700 mb-1">
                        First name
                      </label>
                      <input
                        id="firstName"
                        name="firstName"
                        type="text"
                        autoComplete="given-name"
                        value={firstName}
                        onChange={(e) => setFirstName(e.target.value)}
                        className="w-full border-2 border-slate-200 focus:ring-2 focus:ring-slate-900 focus:border-slate-900 rounded-lg py-3 px-4 transition-all duration-200 ease-in-out"
                      />
                    </div>
                    <div>
                      <label htmlFor="lastName" className="block text-sm font-medium text-slate-700 mb-1">
                        Last name
                      </label>
                      <input
                        id="lastName"
                        name="lastName"
                        type="text"
                        autoComplete="family-name"
                        value={lastName}
                        onChange={(e) => setLastName(e.target.value)}
                        className="w-full border-2 border-slate-200 focus:ring-2 focus:ring-slate-900 focus:border-slate-900 rounded-lg py-3 px-4 transition-all duration-200 ease-in-out"
                      />
                    </div>
                  </>
                )}
              </div>

              <div>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full bg-slate-900 hover:bg-slate-800 text-white font-medium py-3 px-4 rounded-lg transition-all duration-200 ease-in-out shadow-sm hover:shadow-md flex items-center justify-center"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="animate-spin h-5 w-5 mr-2" />
                      {isLogin ? 'Signing in...' : 'Creating account...'}
                    </>
                  ) : (
                    isLogin ? 'Sign in' : 'Create account'
                  )}
                </button>
              </div>
            </form>

            <div className="mt-6 text-center">
              <button 
                onClick={() => setIsLogin(!isLogin)}
                className="text-slate-900 hover:text-slate-700 font-medium text-sm"
              >
                {isLogin ? 'Need an account? Sign up' : 'Already have an account? Sign in'}
              </button>
            </div>
          </div>

          {/* Trust Indicators */}
          <div className="pt-8 border-t border-slate-200">
            <div className="flex items-center justify-center space-x-6 text-sm text-slate-500">
              <div className="flex items-center space-x-2">
                <Shield className="w-4 h-4" />
                <span>Secure</span>
              </div>
              <div className="flex items-center space-x-2">
                <div className="w-4 h-4 bg-green-500 rounded-full flex items-center justify-center">
                  <div className="w-2 h-2 bg-white rounded-full"></div>
                </div>
                <span>Open Source</span>
              </div>
            </div>
            <p className="text-center text-xs text-slate-400 mt-4">
              Protected by industry-leading security standards
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
