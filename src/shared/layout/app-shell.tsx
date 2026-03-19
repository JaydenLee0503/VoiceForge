import { Menu, Moon, Sun, X } from "lucide-react";
import { type ReactNode, useState } from "react";
import { NavLink } from "react-router-dom";

import { BrandMark } from "@/shared/brand/BrandMark";
import { navigationItems } from "@/shared/data/mock";
import { cn } from "@/shared/lib/cn";
import { useTheme } from "@/shared/theme/theme-provider";
import { Button } from "@/shared/ui/button";

type AppShellProps = {
  children: ReactNode;
};

export function AppShell({ children }: AppShellProps) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const { theme, toggleTheme } = useTheme();

  const sidebar = (
    <div className="flex h-full flex-col">
      <div className="border-b border-border px-5 py-5">
        <BrandMark to="/dashboard" />
      </div>

      <nav className="flex-1 space-y-1 px-4 py-5">
        {navigationItems.map((item) => (
          <NavLink
            key={item.href}
            className={({ isActive }) =>
              cn(
                "flex items-center rounded-2xl px-4 py-3 text-sm font-medium transition",
                isActive
                  ? "border border-primary/30 bg-primary/10 text-foreground shadow-glow"
                  : "text-muted-foreground hover:bg-panel-strong hover:text-foreground",
              )
            }
            onClick={() => setMobileNavOpen(false)}
            to={item.href}
          >
            {item.label}
          </NavLink>
        ))}
      </nav>

      <div className="border-t border-border px-4 py-5">
        <div className="space-y-3">
          <Button className="w-full justify-start" onClick={toggleTheme} variant="secondary">
            {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            {theme === "dark" ? "Light mode" : "Dark mode"}
          </Button>
          <Button className="w-full justify-start" to="/" variant="ghost">
            Exit workspace
          </Button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="relative min-h-screen bg-background text-foreground">
      <div className="pointer-events-none absolute inset-0 bg-app-grid opacity-50" />
      <div className="pointer-events-none absolute inset-0 bg-app-radial" />

      <div className="relative mx-auto flex min-h-screen max-w-[1600px]">
        <aside className="sticky top-0 hidden h-screen w-80 border-r border-border bg-shell/95 backdrop-blur xl:block">
          {sidebar}
        </aside>

        <div className="flex min-h-screen min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-40 border-b border-border bg-shell/85 px-4 py-4 backdrop-blur xl:hidden">
            <div className="flex items-center justify-between">
              <BrandMark compact to="/dashboard" />
              <Button
                aria-label="Toggle navigation"
                onClick={() => setMobileNavOpen((current) => !current)}
                size="icon"
                variant="secondary"
              >
                {mobileNavOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
              </Button>
            </div>
            {mobileNavOpen && (
              <div className="mt-4 rounded-3xl border border-border bg-panel shadow-panel">
                {sidebar}
              </div>
            )}
          </header>

          <main className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">{children}</main>
        </div>
      </div>
    </div>
  );
}
