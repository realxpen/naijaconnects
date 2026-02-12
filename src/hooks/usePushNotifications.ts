import { useState, useEffect } from "react";
import { supabase } from "../supabaseClient";

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY as string;

// Helper to convert VAPID key for the browser
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

  // 1. Check Status on Load
  const checkStatus = async () => {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;
    
    // Check Permission
    setPermission(Notification.permission);

    // Check Service Worker Subscription
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      
      // We are subscribed if the browser has a subscription object
      setIsSubscribed(!!subscription);
    } catch (e) {
      console.error("Error checking subscription status:", e);
      setIsSubscribed(false);
    }
  };

  useEffect(() => {
    checkStatus();
  }, [userId]);

  // 2. Subscribe (Enable)
  const subscribeToPush = async () => {
    if (!userId || !VAPID_PUBLIC_KEY) {
        console.error("Missing User ID or VAPID Key");
        return false;
    }
    
    setLoading(true);
    try {
      // A. Request Browser Permission
      const result = await Notification.requestPermission();
      setPermission(result);
      if (result !== "granted") {
          throw new Error("Permission denied");
      }

      // B. Register Service Worker
      const registration = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;

      // C. Get Subscription from Browser
      // We assume userVisibleOnly: true is required
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      });

      // 🔴 CRITICAL FIX: Save as pure JSON
      const subscriptionData = subscription.toJSON();

      // D. Save to Supabase (Simplified)
      const { error } = await supabase
        .from("push_subscriptions")
        .upsert(
          {
            user_id: userId,
            subscription: subscriptionData, // <--- Just save the whole object here
            user_agent: navigator.userAgent,
            // updated_at: new Date().toISOString(), // Use this if you have the column, otherwise remove
          },
          { onConflict: "subscription" } // Ensure DB has unique constraint on this column if possible, or user_id
        );

      if (error) {
          console.error("Supabase DB Error:", error.message);
          throw error;
      }

      setIsSubscribed(true);
      console.log("Successfully subscribed!");
      return true;

    } catch (error) {
      console.error("Subscription failed:", error);
      return false;
    } finally {
      setLoading(false);
    }
  };

  // 3. Unsubscribe (Disable)
  const unsubscribeFromPush = async () => {
    setLoading(true);
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      
      if (subscription) {
        // A. Remove from Database first (Cleanup)
        // We use the endpoint to identify the row to delete
        const endpoint = subscription.endpoint;
        // Depending on how you stored it, you might need to filter by the JSON content
        // But for now, we will try to match the user_id if you allow one device per user, 
        // or we rely on the backend cleaning up dead tokens.
        
        // Unsubscribing from browser is the most important part:
        await subscription.unsubscribe();
      }

      setIsSubscribed(false);
      return true;
    } catch (error) {
      console.error("Unsubscribe failed:", error);
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
    unsubscribeFromPush,
    checkStatus,
  };
};