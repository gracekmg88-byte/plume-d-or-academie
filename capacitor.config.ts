import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.lovable.d11bc5d4512e4b5f9f8a79e7ee7ad869',
  appName: 'plume-d-or-academie',
  webDir: 'dist',
  // Fond de la vue web : bleu nuit (et non blanc) pendant le chargement.
  backgroundColor: '#0f172a',
  plugins: {
    SplashScreen: {
      // Reste affiché jusqu'à ce que le site soit prêt (SplashScreen.hide() dans src/lib/app-splash.ts),
      // 8 s au plus.
      launchShowDuration: 8000,
      launchAutoHide: true,
      backgroundColor: '#0f172a',
      androidScaleType: 'CENTER_CROP',
      showSpinner: false,
      splashFullScreen: true,
      splashImmersive: true
    }
  }
};

export default config;
