import { useEffect } from "react";
import { Capacitor, registerPlugin } from "@capacitor/core";

// Plugin natif de l'appli Android (android/.../ScreenProtectionPlugin.java).
interface ScreenProtectionPlugin {
  enable(): Promise<void>;
  disable(): Promise<void>;
}
const ScreenProtection = registerPlugin<ScreenProtectionPlugin>("ScreenProtection");

/**
 * Appli Android : bloque les captures et l'enregistrement d'écran tant que le composant est affiché
 * (la capture donne une image noire). Sans effet sur le site web, où un navigateur ne permet pas de
 * l'empêcher, ni sur une ancienne version de l'appli qui n'a pas le plugin.
 */
export function useBlockScreenCapture(active = true) {
  useEffect(() => {
    if (!active || !Capacitor.isNativePlatform()) return;
    ScreenProtection.enable().catch(() => {});
    return () => {
      ScreenProtection.disable().catch(() => {});
    };
  }, [active]);
}
