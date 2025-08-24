// src/components/shared/Header.tsx
"use client"

import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Mic, Bell, Search, Settings, BarChart3, Users, FileText, Zap, ChevronDown, HelpCircle, Command, ChevronRight, Slash, BookOpen, LogOut, User } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { useEffect, useState } from "react";

interface HeaderProps {
  breadcrumb?: {
    project?: string;
    item?: string;
  }
}

function Header({ breadcrumb }: HeaderProps) {
  const pathname = usePathname();
  const [breadcrumbState, setBreadcrumbState] = useState<{
    project?: string;
    item?: string;
  } | null>(null);
  const router = useRouter();
  const [user, setUser] = useState<any>(null);

  // Fetch user data from JWT auth
  useEffect(() => {
    const fetchUser = async () => {
      try {
        const response = await fetch('/api/auth/me');
        if (response.ok) {
          const userData = await response.json();
          setUser(userData.user);
        }
      } catch (error) {
        console.error('Failed to fetch user:', error);
      }
    };
    fetchUser();
  }, []);

  useEffect(()=>{
    if(breadcrumb){
      setBreadcrumbState(breadcrumb)
    }
  },[breadcrumb])

  // Get user's display name
  const getUserDisplayName = () => {
    if (user?.name) return user.name;
    if (user?.email) {
      return user.email.split('@')[0];
    }
    return 'User';
  };

  // Handle logout
  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      router.push('/sign-in');
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  // Don't render header if user is not authenticated
  if (!user) return null;

  return (
    <header className="bg-white/95 backdrop-blur-sm border-b border-gray-200/60 sticky top-0 z-50 shadow-sm">
        <div className="px-6 py-3">
          <div className="flex items-center justify-between max-w-[1600px] mx-auto">
            {/* Logo & Brand Section */}
            <div className="flex items-center gap-6">
              <Link href="/" className="flex items-center gap-3 group">
                  <Image src="/logo.png" alt="Pype AI Logo" width={48} height={48} className="group-hover:scale-110 transition-transform duration-200" />
                <div>
                  <h1 className="text-lg font-bold text-gray-900 group-hover:text-blue-600 transition-colors duration-200 tracking-tight">
                    Whispey
                  </h1>
                  <p className="text-xs text-gray-500 -mt-0.5 font-medium">LiveKit Observability Platform</p>
                </div>
              </Link>

              {/* Apple-Style Clean Breadcrumb */}
              {breadcrumbState && (
                <div className="flex items-center">
                  <div className="w-px h-6 bg-gray-200 mx-6"></div>
                  <nav className="flex items-center gap-2 text-sm">
                    <Link 
                      href="/" 
                      className="text-gray-500 hover:text-gray-900 transition-colors"
                    >
                      Home
                    </Link>
                    
                    {breadcrumbState.project && (
                      <>
                        <ChevronRight className="w-4 h-4 text-gray-300" />
                        <span className="text-gray-900">
                          {breadcrumbState.project}
                        </span>
                      </>
                    )}
                    
                    {breadcrumbState.item && (
                      <>
                        <ChevronRight className="w-4 h-4 text-gray-300" />
                        <span className="text-gray-900">
                          {breadcrumbState.item}
                        </span>
                      </>
                    )}
                  </nav>
                </div>
              )}
            </div>

            {/* Right Side Actions */}
            <div className="flex items-center gap-2">
              {/* Setup Instructions Link - New Addition */}
              <Link
                href="https://pypi.org/project/Whispey/"
                target="_blank"
                rel="noopener noreferrer"
                className="group flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-gray-600 hover:text-blue-600 transition-all duration-200 rounded-lg hover:bg-blue-50/50 border border-transparent hover:border-blue-100"
              >
                <BookOpen className="w-4 h-4 transition-transform group-hover:scale-110" />
                <span className="hidden sm:inline">Setup instructions</span>
                <span className="sm:hidden">Setup</span>
                <svg 
                  className="w-3 h-3 opacity-50 group-hover:opacity-100 transition-opacity" 
                  fill="none" 
                  stroke="currentColor" 
                  viewBox="0 0 24 24"
                >
                  <path 
                    strokeLinecap="round" 
                    strokeLinejoin="round" 
                    strokeWidth={2} 
                    d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" 
                  />
                </svg>
              </Link>

              {/* Vertical Separator */}
              <div className="w-px h-5 bg-gray-200"></div>

              {/* Help Dropdown */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-gray-500 hover:text-gray-700 hover:bg-gray-50 w-9 h-9 p-0 rounded-lg border border-transparent hover:border-gray-200 transition-all duration-200"
                  >
                    <HelpCircle className="w-4 h-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-64 shadow-lg border border-gray-200/80 rounded-xl backdrop-blur-sm bg-white/95">
                  <div className="px-3 py-2 border-b border-gray-100">
                    <p className="text-sm font-semibold text-gray-900">Help & Resources</p>
                    <p className="text-xs text-gray-500 mt-0.5">Get support and documentation</p>
                  </div>
                  <div className="py-1">
                    <DropdownMenuItem asChild>
                      <Link href="/docs" className="flex items-center w-full px-3 py-2 hover:bg-gray-50 rounded-lg mx-1">
                        <FileText className="w-4 h-4 mr-3 text-blue-600" />
                        <div>
                          <p className="font-medium text-gray-900">Documentation</p>
                          <p className="text-xs text-gray-500">API guides and tutorials</p>
                        </div>
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link href="/api-reference" className="flex items-center w-full px-3 py-2 hover:bg-gray-50 rounded-lg mx-1">
                        <Zap className="w-4 h-4 mr-3 text-yellow-600" />
                        <div>
                          <p className="font-medium text-gray-900">API Reference</p>
                          <p className="text-xs text-gray-500">Complete API documentation</p>
                        </div>
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link href="/community" className="flex items-center w-full px-3 py-2 hover:bg-gray-50 rounded-lg mx-1">
                        <Users className="w-4 h-4 mr-3 text-green-600" />
                        <div>
                          <p className="font-medium text-gray-900">Community</p>
                          <p className="text-xs text-gray-500">Connect with developers</p>
                        </div>
                      </Link>
                    </DropdownMenuItem>
                  </div>
                  <DropdownMenuSeparator className="bg-gray-100" />
                  <div className="py-1">
                    <DropdownMenuItem asChild>
                      <Link href="/support" className="flex items-center w-full px-3 py-2 hover:bg-gray-50 rounded-lg mx-1">
                        <HelpCircle className="w-4 h-4 mr-3 text-purple-600" />
                        <div>
                          <p className="font-medium text-gray-900">Contact Support</p>
                          <p className="text-xs text-gray-500">Get help from our team</p>
                        </div>
                      </Link>
                    </DropdownMenuItem>
                  </div>
                </DropdownMenuContent>
              </DropdownMenu>

              {/* User Profile Section */}
              <div className="flex items-center gap-3 pl-4 ml-2 border-l border-gray-200">
                <div className="hidden sm:flex flex-col items-end">
                  <p className="text-sm font-semibold text-gray-900 leading-none">{getUserDisplayName()}</p>
                </div>
                
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <div className="relative cursor-pointer">
                      <div className="w-9 h-9 ring-2 ring-gray-100 hover:ring-blue-200 transition-all duration-200 shadow-sm hover:shadow-md rounded-full bg-blue-500 flex items-center justify-center text-white font-semibold text-sm">
                        {getUserDisplayName().charAt(0).toUpperCase()}
                      </div>
                      {/* Online Status Indicator */}
                      <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-500 rounded-full border-2 border-white shadow-sm"></div>
                    </div>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56 shadow-2xl border border-gray-100 rounded-2xl backdrop-blur-sm bg-white/95">
                    <div className="px-3 py-2 border-b border-gray-100">
                      <p className="text-sm font-semibold text-gray-900">{getUserDisplayName()}</p>
                      <p className="text-xs text-gray-500">{user?.email}</p>
                    </div>
                    <div className="py-1">
                      <DropdownMenuItem className="flex items-center w-full px-3 py-2 hover:bg-gray-50 rounded-lg mx-1 cursor-pointer">
                        <User className="w-4 h-4 mr-3 text-gray-600" />
                        <span className="font-medium text-gray-900">Profile</span>
                      </DropdownMenuItem>
                      <DropdownMenuItem className="flex items-center w-full px-3 py-2 hover:bg-gray-50 rounded-lg mx-1 cursor-pointer">
                        <Settings className="w-4 h-4 mr-3 text-gray-600" />
                        <span className="font-medium text-gray-900">Settings</span>
                      </DropdownMenuItem>
                    </div>
                    <DropdownMenuSeparator className="bg-gray-100" />
                    <div className="py-1">
                      <DropdownMenuItem onClick={handleLogout} className="flex items-center w-full px-3 py-2 hover:bg-red-50 rounded-lg mx-1 cursor-pointer text-red-600 hover:text-red-700">
                        <LogOut className="w-4 h-4 mr-3" />
                        <span className="font-medium">Sign out</span>
                      </DropdownMenuItem>
                    </div>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          </div>
        </div>
        
        {/* Subtle bottom gradient */}
        <div className="h-px bg-gradient-to-r from-transparent via-gray-200/50 to-transparent"></div>
    </header>
  );
}

export default Header;