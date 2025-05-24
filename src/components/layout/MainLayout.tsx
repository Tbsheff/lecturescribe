import React, { ReactNode } from 'react';

interface MainLayoutProps {
  children: ReactNode;
}

export const MainLayout = ({ children }: MainLayoutProps) => {
  return (
    <div className="flex h-screen">
      <aside className="w-64 bg-gray-50 border-r overflow-y-auto">
        {/* TODO: Render folder tree here */}
        <div className="p-4 text-sm text-gray-500">Sidebar placeholder</div>
      </aside>
      <main className="flex-1 overflow-y-auto">
        {children}
      </main>
    </div>
  );
};
