'use client';

import { GoogleOAuthProvider } from '@react-oauth/google';
import { ReactNode } from 'react';

export function GoogleOAuthWrapper({ children }: { children: ReactNode }) {
  // Use actual client ID if available, otherwise use placeholder (will be disabled in UI)
  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || 'placeholder-client-id';

  return (
    <GoogleOAuthProvider clientId={clientId}>
      {children}
    </GoogleOAuthProvider>
  );
}
