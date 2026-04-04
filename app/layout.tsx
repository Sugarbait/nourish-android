import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { Toaster } from '@/components/ui/toaster';
import { ThemeProvider } from '@/components/theme-provider';
import { ConvexClientProvider } from '@/components/convex-client-provider';
import { GoogleOAuthWrapper } from '@/components/google-oauth-wrapper';

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
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="icon" href="/favicon.ico" sizes="any" />
        <link rel="icon" href="/icon.png" type="image/png" />
        <link rel="apple-touch-icon" href="/icon.png" />
      </head>
      <body className={`${inter.variable} font-sans antialiased`} suppressHydrationWarning>
        {/* Global fix: prevent Radix UI from locking pointer-events on body (mobile Safari bug) */}
        <script dangerouslySetInnerHTML={{ __html: `
          (function(){
            var o = new MutationObserver(function(mutations){
              mutations.forEach(function(m){
                if(m.type==='attributes' && m.attributeName==='style'){
                  var pe = document.body.style.pointerEvents;
                  if(pe === 'none'){
                    document.body.style.pointerEvents = '';
                  }
                }
              });
            });
            o.observe(document.body, { attributes: true, attributeFilter: ['style'] });
          })();
        `}} />
        <ConvexClientProvider>
          <GoogleOAuthWrapper>
          <ThemeProvider
              attribute="class"
              defaultTheme="dark"
              enableSystem
              disableTransitionOnChange
          >
              {children}
              <Toaster />
          </ThemeProvider>
          </GoogleOAuthWrapper>
        </ConvexClientProvider>
      </body>
    </html>
  );
}
