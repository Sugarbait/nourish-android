import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.neoncell.nourish',
  appName: 'Nourish',
  webDir: 'out',
  ios: {
    contentInset: 'automatic',
  },
  android: {
    allowMixedContent: true,
  },
  plugins: {
    Purchase: {
      googlePlayKey: process.env.GOOGLE_PLAY_KEY || '',
    },
    GoogleAuth: {
      scopes: ['profile', 'email'],
      serverClientId: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || '',
      forceCodeForRefreshToken: true,
    },
    SplashScreen: {
      launchShowDuration: 1500,
      launchAutoHide: false,           // we hide it manually once the WebView is mounted
      backgroundColor: '#0A1410',      // dark base matching the site's bg
      androidScaleType: 'CENTER_CROP',
      showSpinner: false,
      splashFullScreen: true,
      splashImmersive: true,
    },
  },
};

export default config;
