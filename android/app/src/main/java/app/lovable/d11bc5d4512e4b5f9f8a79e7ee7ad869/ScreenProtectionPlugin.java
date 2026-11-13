package app.lovable.d11bc5d4512e4b5f9f8a79e7ee7ad869;

import android.view.WindowManager;

import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Bloque les captures et l'enregistrement d'écran (FLAG_SECURE) pendant la lecture d'un livre.
 * Activé par le lecteur PDF à son ouverture, désactivé à sa fermeture (src/lib/screen-protection.ts).
 */
@CapacitorPlugin(name = "ScreenProtection")
public class ScreenProtectionPlugin extends Plugin {

    @PluginMethod
    public void enable(PluginCall call) {
        getActivity().runOnUiThread(() -> {
            getActivity().getWindow().addFlags(WindowManager.LayoutParams.FLAG_SECURE);
            call.resolve();
        });
    }

    @PluginMethod
    public void disable(PluginCall call) {
        getActivity().runOnUiThread(() -> {
            getActivity().getWindow().clearFlags(WindowManager.LayoutParams.FLAG_SECURE);
            call.resolve();
        });
    }
}
