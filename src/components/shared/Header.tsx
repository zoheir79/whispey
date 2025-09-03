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

            {/* Desktop Navigation - Hidden on mobile */}
            {!roleLoading && (
              <div className="hidden md:flex items-center gap-1">
                {/* Workspaces Access - Differentiated for Admins vs Users */}
                <Link
                  href="/"
                  className="group flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-gray-600 hover:text-blue-600 transition-all duration-200 rounded-lg hover:bg-blue-50/50 border border-transparent hover:border-blue-100"
                >
                  <Folders className="w-4 h-4 transition-transform group-hover:scale-110" />
                  <span>{isAdmin ? 'All Workspaces' : 'My Workspace'}</span>
                </Link>

                {/* Agents Access */}
                <Link
                  href="/agents"
                  className="group flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-gray-600 hover:text-green-600 transition-all duration-200 rounded-lg hover:bg-green-50/50 border border-transparent hover:border-green-100"
                >
                  <Bot className="w-4 h-4 transition-transform group-hover:scale-110" />
                  <span>{isAdmin ? 'All Agents' : 'My Agents'}</span>
                </Link>

                {/* Calls Access */}
                <Link
                  href="/calls"
                  className="group flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-gray-600 hover:text-purple-600 transition-all duration-200 rounded-lg hover:bg-purple-50/50 border border-transparent hover:border-purple-100"
                >
                  <Phone className="w-4 h-4 transition-transform group-hover:scale-110" />
                  <span>{isAdmin ? 'All Calls' : 'My Calls'}</span>
                </Link>

                {/* Admin Badge */}
                {isAdmin && (
                  <Badge variant="outline" className="ml-2 text-xs font-medium bg-blue-50 text-blue-700 border-blue-200">
                    {isSuperAdmin ? 'Super Admin' : 'Admin'}
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
                            <Link href="/settings" className="flex items-center w-full px-3 py-2 hover:bg-gray-50 rounded-lg mx-1 cursor-pointer">
                              <Settings className="w-4 h-4 mr-3 text-gray-600" />
                              <span className="font-medium text-gray-900">Settings</span>
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