import React from "react";
import { useAuth } from "@/hooks/useAuth";
import { Navigate } from "react-router-dom";

interface MainLayoutProps {
  children: React.ReactNode;
  requireAuth?: boolean;
}

export const MainLayout: React.FC<MainLayoutProps> = ({ children, requireAuth = true }) => {
  const { user, loading } = useAuth();

  if (requireAuth && !loading && !user) {
    return <Navigate to="/auth" />;
  }

  return <>{children}</>;
};
