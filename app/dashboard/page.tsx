'use client';

import { useConvexAuth } from 'convex/react';
import { Dashboard } from '@/components/dashboard';

export default function DashboardPage() {
  const { isAuthenticated, isLoading } = useConvexAuth();

  // Show spinner only while auth state is resolving
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }

  // Allow both authenticated users and guests — isGuest controls restrictions inside
  return (
    <main>
      <Dashboard isGuest={!isAuthenticated} />
    </main>
  );
}
