import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { Toaster } from '@/components/ui/toaster';
import { ThemeProvider } from '@/components/theme-provider';
import { ConvexClientProvider } from '@/components/convex-client-provider';
import { GoogleOAuthWrapper } from '@/components/google-oauth-wrapper';
import { NotificationProvider } from '@/components/notification-context';
import { NotificationDisplay } from '@/components/notification-display';
import { AppUpdateChecker } from '@/components/app-update-checker';
import { SplashHider } from '@/components/splash-hider';

const inter = Inter({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800', '900'],
  variable: '--font-sans',
});

export const metadata: Metadata = {
  title: 'Nourish',
  description: 'AI-Powered Calorie Counter',
  icons: {
    icon: '/icon.png',
    shortcut: '/favicon.ico',
    apple: '/icon.png',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning style={{ backgroundColor: '#0A1410' }}>
      <head>
        <link rel="icon" href="/favicon.ico" sizes="any" />
        <link rel="icon" href="/icon.png" type="image/png" />
        <link rel="apple-touch-icon" href="/icon.png" />
      </head>
      {/*
        Inline styles below paint the brand background + centered logo
        immediately as the HTML is parsed — before CSS or JS load — so
        navigating between pages (each page is a separate HTML file in
        the static export) never shows a white flash. The logo appears
        for the brief moment between HTML parse and first content paint;
        once a page's content renders, its own background covers the body.
      */}
      <body
        className={`${inter.variable} font-sans antialiased`}
        suppressHydrationWarning
        style={{
          backgroundColor: '#0A1410',
          backgroundImage: 'url(/logo-icon.png)',
          backgroundRepeat: 'no-repeat',
          backgroundPosition: 'center center',
          backgroundSize: '96px 96px',
        }}
      >
        <ConvexClientProvider>
          <GoogleOAuthWrapper>
          <ThemeProvider
              attribute="class"
              defaultTheme="dark"
              enableSystem
              disableTransitionOnChange
          >
            <NotificationProvider>
              {children}
              <Toaster />
              <NotificationDisplay />
              <AppUpdateChecker />
              <SplashHider />
            </NotificationProvider>
          </ThemeProvider>
          </GoogleOAuthWrapper>
        </ConvexClientProvider>
      </body>
    </html>
  );
}
