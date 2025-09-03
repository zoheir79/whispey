// src/components/shared/Header.tsx
"use client"

import { useState, useEffect } from "react"
import { usePathname, useRouter } from "next/navigation"
import Link from "next/link"
import Image from "next/image"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu"
import { 
  Folders, 
  Users, 
  Phone, 
  BookOpen, 
  HelpCircle, 
  LogOut, 
  User, 
  ChevronDown,
  ChevronRight,
  MoreHorizontal,
  Menu,
  X,
  Bot,
  FileText,
  Zap,
  Settings
} from "lucide-react"
import { useGlobalRole } from "@/hooks/useGlobalRole"

interface HeaderProps {
  breadcrumb?: {
    project?: string;
    item?: string;
  }
}

interface User {
  name?: string;
  email?: string;
}

interface BreadcrumbState {
  project?: string;
  item?: string;
}

function Header({ breadcrumb }: HeaderProps) {
  const pathname = usePathname();
  const [breadcrumbState, setBreadcrumbState] = useState<BreadcrumbState | null>(null);
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const { globalRole, permissions, isAdmin, isSuperAdmin, isLoading: roleLoading } = useGlobalRole();

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
    <header className="bg-gradient-to-r from-slate-900/95 via-slate-800/95 to-slate-900/95 backdrop-blur-xl border-b border-cyan-500/20 sticky top-0 z-50 shadow-2xl shadow-cyan-500/10">
      <div className="px-6 py-4 relative">
        {/* Futuristic glow effect */}
        <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/5 via-purple-500/5 to-cyan-500/5 animate-pulse"></div>
        <div className="flex items-center justify-between max-w-[1600px] mx-auto relative z-10">
          {/* Logo & Brand Section */}
          <div className="flex items-center gap-6">
            <Link href="/" className="flex items-center gap-3 group">
              <div className="relative">
                <Image src="/logo.png" alt="Pype AI Logo" width={48} height={48} className="group-hover:scale-110 transition-all duration-300 drop-shadow-lg" />
                <div className="absolute inset-0 bg-cyan-400/20 rounded-full blur-lg group-hover:bg-cyan-400/40 transition-all duration-300"></div>
              </div>
              <div>
                <h1 className="text-xl font-black text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-purple-400 to-cyan-400 group-hover:from-cyan-300 group-hover:to-purple-300 transition-all duration-300 tracking-tight">
                  Whispey
                </h1>
                <p className="text-xs text-cyan-300/70 -mt-0.5 font-medium tracking-wide">LiveKit Observability Platform</p>
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

          {/* Desktop Navigation - Hidden on mobile */}
          {!roleLoading && (
            <div className="hidden md:flex items-center gap-2">
              {/* Workspaces Access - Futuristic Design */}
              <Link
                href="/"
                className="group flex items-center gap-2 px-4 py-2 text-sm font-medium text-cyan-300/80 hover:text-cyan-300 transition-all duration-300 rounded-xl bg-slate-800/50 hover:bg-slate-700/70 border border-cyan-500/20 hover:border-cyan-400/40 backdrop-blur-sm hover:shadow-lg hover:shadow-cyan-500/20"
              >
                <Folders className="w-4 h-4 transition-all duration-300 group-hover:scale-110 group-hover:text-cyan-300" />
                <span className="font-semibold tracking-wide">{isAdmin ? 'All Workspaces' : 'My Workspace'}</span>
              </Link>

              {/* Agents Access */}
              <Link
                href="/agents"
                className="group flex items-center gap-2 px-4 py-2 text-sm font-medium text-emerald-300/80 hover:text-emerald-300 transition-all duration-300 rounded-xl bg-slate-800/50 hover:bg-slate-700/70 border border-emerald-500/20 hover:border-emerald-400/40 backdrop-blur-sm hover:shadow-lg hover:shadow-emerald-500/20"
              >
                <Bot className="w-4 h-4 transition-all duration-300 group-hover:scale-110 group-hover:text-emerald-300" />
                <span className="font-semibold tracking-wide">{isAdmin ? 'All Agents' : 'My Agents'}</span>
              </Link>

              {/* Global Calls Access (Admin/Super Admin only) */}
              {isAdmin && (
                <Link
                  href="/calls"
                  className="group flex items-center gap-2 px-4 py-2 text-sm font-medium text-purple-300/80 hover:text-purple-300 transition-all duration-300 rounded-xl bg-slate-800/50 hover:bg-slate-700/70 border border-purple-500/20 hover:border-purple-400/40 backdrop-blur-sm hover:shadow-lg hover:shadow-purple-500/20"
                >
                  <Phone className="w-4 h-4 transition-all duration-300 group-hover:scale-110 group-hover:text-purple-300" />
                  <span className="font-semibold tracking-wide">All Calls</span>
                </Link>
              )}
              {/* Admin Badge - Futuristic */}
              {isAdmin && (
                <Badge className="ml-3 px-3 py-1 text-xs font-bold bg-gradient-to-r from-amber-400/20 to-orange-400/20 text-amber-300 border border-amber-400/30 backdrop-blur-sm shadow-lg shadow-amber-500/20 animate-pulse">
                  {isSuperAdmin ? '⚡ SUPER ADMIN' : '🔑 ADMIN'}
                </Badge>
              )}
            </div>
          )}

          {/* Mobile Menu Button */}
          <div className="md:hidden">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="p-2"
            >
              {isMobileMenuOpen ? (
                <X className="w-5 h-5" />
              ) : (
                <Menu className="w-5 h-5" />
              )}
            </Button>
          </div>

          {/* Right Side Actions */}
          <div className="hidden md:flex items-center gap-2">
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
            <div className="w-px h-5 bg-gray-200 mx-2"></div>

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
                    <DropdownMenuItem asChild>
                      <Link href="/profile" className="flex items-center w-full px-3 py-2 hover:bg-gray-50 rounded-lg mx-1 cursor-pointer">
                        <User className="w-4 h-4 mr-3 text-gray-600" />
                        <span className="font-medium text-gray-900">Profile</span>
                      </Link>
                    </DropdownMenuItem>
                    {isSuperAdmin && (
                      <>
                        <DropdownMenuItem asChild>
                          <Link href="/admin/settings" className="flex items-center w-full px-3 py-2 hover:bg-gray-50 rounded-lg mx-1 cursor-pointer">
                            <Settings className="w-4 h-4 mr-3 text-gray-600" />
                            <span className="font-medium text-gray-900">Admin Settings</span>
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem asChild>
                          <Link href="/admin/users" className="flex items-center w-full px-3 py-2 hover:bg-gray-50 rounded-lg mx-1 cursor-pointer">
                            <Users className="w-4 h-4 mr-3 text-blue-600" />
                            <span className="font-medium text-gray-900">Admin Users</span>
                          </Link>
                        </DropdownMenuItem>
                      </>
                    )}
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
        
        {/* Subtle bottom gradient */}
        <div className="h-px bg-gradient-to-r from-transparent via-gray-200/50 to-transparent"></div>
        
        {/* Mobile Menu Overlay */}
        {isMobileMenuOpen && (
          <div className="md:hidden absolute top-full left-0 right-0 bg-white border-b border-gray-200 shadow-lg z-40">
            <div className="px-6 py-4 space-y-3">
              {/* Mobile Navigation Links */}
              {!roleLoading && (
                <>
                  <Link
                    href="/"
                    className="flex items-center gap-3 px-3 py-2 text-sm font-medium text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all duration-200"
                    onClick={() => setIsMobileMenuOpen(false)}
                  >
                    <Folders className="w-4 h-4" />
                    <span>{isAdmin ? 'All Workspaces' : 'My Workspace'}</span>
                  </Link>

                  <Link
                    href="/agents"
                    className="flex items-center gap-3 px-3 py-2 text-sm font-medium text-gray-600 hover:text-green-600 hover:bg-green-50 rounded-lg transition-all duration-200"
                    onClick={() => setIsMobileMenuOpen(false)}
                  >
                    <Bot className="w-4 h-4" />
                    <span>{isAdmin ? 'All Agents' : 'My Agents'}</span>
                  </Link>

                  <Link
                    href="/calls"
                    className="flex items-center gap-3 px-3 py-2 text-sm font-medium text-gray-600 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition-all duration-200"
                    onClick={() => setIsMobileMenuOpen(false)}
                  >
                    <Phone className="w-4 h-4" />
                    <span>{isAdmin ? 'All Calls' : 'My Calls'}</span>
                  </Link>

                  {/* Admin Badge for Mobile */}
                  {isAdmin && (
                    <div className="px-3 py-1">
                      <Badge variant="outline" className="text-xs font-medium bg-blue-50 text-blue-700 border-blue-200">
                        {isSuperAdmin ? 'Super Admin' : 'Admin'}
                      </Badge>
                    </div>
                  )}

                  <div className="h-px bg-gray-200 my-3"></div>

                  {/* Mobile Help Links */}
                  <Link
                    href="https://pypi.org/project/Whispey/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-3 px-3 py-2 text-sm font-medium text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all duration-200"
                    onClick={() => setIsMobileMenuOpen(false)}
                  >
                    <BookOpen className="w-4 h-4" />
                    <span>Setup Instructions</span>
                  </Link>

                  <Link
                    href="/docs"
                    className="flex items-center gap-3 px-3 py-2 text-sm font-medium text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all duration-200"
                    onClick={() => setIsMobileMenuOpen(false)}
                  >
                    <FileText className="w-4 h-4" />
                    <span>Documentation</span>
                  </Link>

                  {/* Mobile User Profile */}
                  <div className="h-px bg-gray-200 my-3"></div>
                  
                  <div className="px-3 py-2">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
                        <User className="w-4 h-4 text-white" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-gray-900">{user?.name || user?.email}</p>
                        {user?.name && user?.email && (
                          <p className="text-xs text-gray-500">{user.email}</p>
                        )}
                      </div>
                    </div>
                    
                    <Button
                      onClick={handleLogout}
                      variant="outline"
                      size="sm"
                      className="w-full justify-start gap-2 text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200"
                    >
                      <LogOut className="w-4 h-4" />
                      Sign out
                    </Button>
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </header>
  );
}

export default Header;