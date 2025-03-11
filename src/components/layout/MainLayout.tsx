
import React from 'react';
import { Sidebar } from './Sidebar';
import { useAuth } from '@/hooks/useAuth';
import { Navigate } from 'react-router-dom';

interface MainLayoutProps {
  children: React.ReactNode;
  requireAuth?: boolean;
}

export const MainLayout: React.FC<MainLayoutProps> = ({ children, requireAuth = true }) => {
  const { user, loading } = useAuth();

  // If authentication is required and the user is not logged in, redirect to auth page
  if (requireAuth && !loading && !user) {
    return <Navigate to="/auth" />;
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 pl-[240px]">
        <div className="container max-w-7xl mx-auto px-6 py-8">
          {children}
        </div>
      </main>
    </div>
  );
};
