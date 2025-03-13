import React from "react";
import { Link, useLocation } from "react-router-dom";
import {
  Home,
  Rocket,
  Settings,
  Moon,
  Sun,
  LogOut,
  Headphones,
  ArrowRight,
  Folder,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/hooks/useAuth";

export const Sidebar = () => {
  const location = useLocation();
  const { theme, setTheme } = useTheme();
  const { user, signOut } = useAuth();

  const navItems = [
    { name: "Home", icon: <Home className="h-5 w-5" />, path: "/" },
    {
      name: "Folders",
      icon: <Folder className="h-5 w-5" />,
      path: "/folders",
    },
    {
      name: "Audio Upload",
      icon: <Headphones className="h-5 w-5" />,
      path: "/audio-summary",
    },
    {
      name: "How to use",
      icon: <Rocket className="h-5 w-5" />,
      path: "/how-to-use",
    },
    {
      name: "Settings",
      icon: <Settings className="h-5 w-5" />,
      path: "/settings",
    },
    {
      name: "Migrate Notes",
      icon: <ArrowRight className="h-5 w-5" />,
      path: "/migrate",
    },
  ];

  return (
    <div className="flex flex-col h-screen fixed left-0 top-0 w-[240px] z-10 bg-sidebar border-r border-border">
      <div className="p-6">
        <Link to="/" className="flex items-center gap-2">
          <div className="bg-brand rounded-full p-1.5 text-white">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-5 w-5"
            >
              <path d="M12 8c-1.657 0-3 1.343-3 3v6h6v-6c0-1.657-1.343-3-3-3Z" />
              <path d="M19 8a7 7 0 0 0-14 0" />
              <path d="M12 8a3 3 0 0 0-3 3" />
              <path d="M12 8a3 3 0 0 1 3 3" />
            </svg>
          </div>
          <h1 className="text-xl font-semibold">
            Lecture<span className="text-brand">Scribe</span>
          </h1>
        </Link>
      </div>

      <nav className="flex-1 overflow-y-auto p-4">
        <ul className="space-y-2">
          {navItems.map((item) => (
            <li key={item.name}>
              <Link
                to={item.path}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                  location.pathname === item.path
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-sidebar-foreground hover:bg-sidebar-accent/50",
                )}
              >
                {item.icon}
                {item.name}
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      <div className="p-4 mt-auto border-t border-border">
        {user && (
          <div className="mb-4">
            <p className="text-sm text-muted-foreground truncate">
              {user.email}
            </p>
            <Button
              variant="outline"
              className="w-full mt-2 justify-start text-sm"
              onClick={() => signOut()}
            >
              <LogOut className="h-4 w-4 mr-2" />
              Sign Out
            </Button>
          </div>
        )}
        <Button
          variant="outline"
          size="icon"
          className="rounded-full"
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
        >
          {theme === "dark" ? (
            <Sun className="h-5 w-5" />
          ) : (
            <Moon className="h-5 w-5" />
          )}
        </Button>
      </div>
    </div>
  );
};
