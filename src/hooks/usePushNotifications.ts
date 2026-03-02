import { useEffect, useRef } from "react";
import { Capacitor } from "@capacitor/core";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

export function usePushNotifications() {
  const { user } = useAuth();
  const registered = useRef(false);

  useEffect(() => {
    if (!user || registered.current) return;
    if (!Capacitor.isNativePlatform()) return;

    const setup = async () => {
      try {
        const { PushNotifications } = await import(
          "@capacitor/push-notifications"
        );

        // Request permission
        const permResult = await PushNotifications.requestPermissions();
        if (permResult.receive !== "granted") {
          console.log("Push notification permission denied");
          return;
        }

        // Register for push notifications
        await PushNotifications.register();

        // Listen for registration success
        PushNotifications.addListener("registration", async (token) => {
          console.log("FCM Token:", token.value);
          registered.current = true;

          // Upsert the token in database
          const { error } = await supabase.from("device_tokens").upsert(
            {
              user_id: user.id,
              token: token.value,
              platform: "android",
            },
            { onConflict: "user_id,token" }
          );

          if (error) {
            console.error("Error saving device token:", error);
          }
        });

        // Listen for errors
        PushNotifications.addListener("registrationError", (err) => {
          console.error("Push registration error:", err);
        });

        // Handle notification received while app is in foreground
        PushNotifications.addListener(
          "pushNotificationReceived",
          (notification) => {
            console.log("Push received:", notification);
          }
        );

        // Handle notification tap
        PushNotifications.addListener(
          "pushNotificationActionPerformed",
          (action) => {
            const data = action.notification.data;
            if (data?.publication_id) {
              window.location.href = `/publication/${data.publication_id}`;
            }
          }
        );
      } catch (err) {
        console.error("Push notification setup error:", err);
      }
    };

    setup();
  }, [user]);
}
