package app.lovable.d11bc5d4512e4b5f9f8a79e7ee7ad869;

import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        // Plugin local : blocage des captures d'écran pendant la lecture (ScreenProtectionPlugin).
        registerPlugin(ScreenProtectionPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
