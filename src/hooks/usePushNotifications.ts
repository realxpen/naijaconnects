import { useState, useEffect } from "react";
import { supabase } from "../supabaseClient";

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY as string;

const urlBase64ToUint8Array = (base64String: string) => {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
};

export const usePushNotifications = (userId?: string) => {
  const [permission, setPermission] = useState<NotificationPermission>("default");
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (typeof Notification !== "undefined") {
      setPermission(Notification.permission);
    }
  }, []);

  const subscribeToPush = async () => {
    // 1. CHECK KEYS
    if (!VAPID_PUBLIC_KEY) {
      alert("CRITICAL ERROR: VITE_VAPID_PUBLIC_KEY is missing. Did you restart 'npm run dev'?");
      return false;
    }
    if (!userId) {
      alert("ERROR: User ID is missing. Are you logged in?");
      return false;
    }

    setLoading(true);
    try {
      // 2. REGISTER SERVICE WORKER
      console.log("Registering SW...");
      const registration = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;
      console.log("SW Registered:", registration);

      // 3. ASK PERMISSION
      const result = await Notification.requestPermission();
      setPermission(result);
      if (result !== "granted") {
        alert("Permission was denied. You must allow notifications in browser settings.");
        setLoading(false);
        return false;
      }

      // 4. GET SUBSCRIPTION
      console.log("Subscribing...");
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      });

      // 5. SAVE TO DB
      const subscriptionData = subscription.toJSON();
      console.log("Saving to DB:", subscriptionData);

      const { error } = await supabase
        .from("push_subscriptions")
        .upsert(
          {
            user_id: userId,
            subscription: subscriptionData,
            user_agent: navigator.userAgent,
          },
          // We don't strictly need onConflict if we rely on RLS, 
          // but to be safe we can ignore duplicates or rely on the Unique constraint
          { onConflict: "subscription" } 
        );

      if (error) {
        console.error("Supabase Error:", error);
        // Alert the specific database error so we know if it's RLS or Schema
        alert(`Database Error: ${error.message}`);
        throw error;
      }

      alert("Success! Notifications Enabled.");
      setIsSubscribed(true);
      return true;

    } catch (error: any) {
      console.error("Setup Failed:", error);
      alert(`Setup Failed: ${error.message}`);
      return false;
    } finally {
      setLoading(false);
    }
  };

  return {
    permission,
    isSubscribed,
    loading,
    subscribeToPush,
    unsubscribeFromPush: async () => {}, // simplified for now
  };
};