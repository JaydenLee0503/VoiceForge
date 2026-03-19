import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Mic2, 
  History, 
  Settings, 
  LogOut,
  ChevronRight,
  Menu,
  X,
  PlusCircle,
  Sun,
  Moon
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { useTheme } from '@/contexts/ThemeContext';

interface SidebarProps {
  className?: string;
}

const navItems = [
  { name: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
  { name: 'Scenarios', path: '/scenarios', icon: Mic2 },
  { name: 'Custom Practice', path: '/custom-practice', icon: PlusCircle },
  { name: 'History', path: '/history', icon: History },
];

export function Sidebar({ className }: SidebarProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();

  return (
    <div className={cn("pb-12 h-full flex flex-col", className)}>
      <div className="space-y-4 py-4">
        <div className="px-3 py-2">
          <Link to="/dashboard" className="flex items-center gap-3 px-4 mb-10 group">
            <div className="h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
              <Mic2 className="h-5 w-5 text-primary" />
            </div>
            <h2 className="text-xl font-semibold tracking-tight">VoiceForge</h2>
          </Link>
          <div className="space-y-1">
            {navItems.map((item) => (
              <Link key={item.path} to={item.path}>
                <Button
                  variant={location.pathname === item.path ? "secondary" : "ghost"}
                  className={cn(
                    "w-full justify-start gap-3 h-11 text-sm font-medium transition-all",
                    location.pathname === item.path 
                      ? "bg-secondary text-foreground" 
                      : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
                  )}
                  onClick={() => {}}
                >
                  <item.icon className="h-4 w-4" />
                  {item.name}
                </Button>
              </Link>
            ))}
          </div>
        </div>
      </div>
      <div className="mt-auto px-3 py-2 space-y-1">
        <Button 
          variant="ghost" 
          className="w-full justify-start gap-3 h-11 text-sm font-medium text-muted-foreground hover:text-destructive hover:bg-destructive/10" 
          onClick={() => navigate('/')}
        >
          <LogOut className="h-4 w-4" />
          Sign Out
        </Button>
        <Button 
          variant="ghost" 
          className="w-full justify-start gap-3 h-11 text-sm font-medium text-muted-foreground hover:bg-secondary/50" 
          onClick={toggleTheme}
        >
          {theme === 'dark' ? (
            <>
              <Sun className="h-4 w-4" />
              Light Mode
            </>
          ) : (
            <>
              <Moon className="h-4 w-4" />
              Dark Mode
            </>
          )}
        </Button>
      </div>
    </div>
  );
}

export function MainLayout({ children }: { children: React.ReactNode }) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false);

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex w-64 flex-col border-r border-border bg-card sticky top-0 h-screen overflow-y-auto">
        <Sidebar />
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile Header */}
        <header className="md:hidden flex items-center justify-between p-4 border-b border-border bg-card sticky top-0 z-50">
          <Link to="/dashboard" className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <Mic2 className="h-4 w-4 text-primary" />
            </div>
            <span className="font-semibold">VoiceForge</span>
          </Link>
          <Sheet open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="p-0 w-64 bg-card border-r border-border">
              <Sidebar className="px-2" />
            </SheetContent>
          </Sheet>
        </header>

        <main className="flex-1 overflow-x-hidden">
          {children}
        </main>
      </div>
    </div>
  );
}
