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
  // Safe initial state check that works on all devices
  const [permission, setPermission] = useState<NotificationPermission>(
    typeof window !== "undefined" && "Notification" in window 
      ? Notification.permission 
      : "default"
  );
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [loading, setLoading] = useState(false);
  
  // NEW: State to trigger the "Add to Home Screen" modal
  const [showInstallPrompt, setShowInstallPrompt] = useState(false);

  // 1. Check Status (Safe Mode)
  const checkStatus = async () => {
    // If browser doesn't support SW or Push, we just stop silently for now.
    if (typeof window === "undefined" || !("serviceWorker" in navigator) || !("PushManager" in window)) {
      return;
    }
    
    if ("Notification" in window) {
      setPermission(Notification.permission);
    }

    try {
      const registration = await navigator.serviceWorker.getRegistration();
      if (registration) {
        const subscription = await registration.pushManager.getSubscription();
        setIsSubscribed(!!subscription);
      }
    } catch (e) {
      console.error("Error checking subscription:", e);
    }
  };

  useEffect(() => {
    checkStatus();
  }, [userId]);

  // 2. Subscribe (Safe Mode)
  const subscribeToPush = async () => {
    // A. Check for Vercel Key
    if (!VAPID_PUBLIC_KEY) {
      alert("System Error: Notification Key is missing in settings.");
      return false;
    }

    // B. Check for iOS / Browser Support
    // If 'Notification' is missing, it's likely iOS in Browser Mode.
    if (typeof window === "undefined" || !("Notification" in window)) {
      // TRIGGER THE MODAL instead of an alert
      setShowInstallPrompt(true);
      return false;
    }

    if (!userId) {
      alert("Please log in to enable notifications.");
      return false;
    }

    setLoading(true);
    try {
      // C. Register Service Worker
      console.log("Registering SW...");
      const registration = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;

      // D. Ask Permission
      const result = await Notification.requestPermission();
      setPermission(result);
      
      if (result !== "granted") {
        alert("Permission denied. You must allow notifications in your browser settings.");
        setLoading(false);
        return false;
      }

      // E. Get Subscription
      console.log("Subscribing...");
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      });

      // F. Save to DB
      const subscriptionData = subscription.toJSON();
      const { error } = await supabase
        .from("push_subscriptions")
        .upsert(
          {
            user_id: userId,
            subscription: subscriptionData,
            user_agent: navigator.userAgent,
          },
          { onConflict: "subscription" }
        );

      if (error) throw error;

      alert("Success! Notifications Enabled.");
      setIsSubscribed(true);
      return true;

    } catch (error: any) {
      console.error("Setup Failed:", error);
      // Optional: If error mentions 'serviceWorker', show install prompt
      if(error.message && error.message.includes("serviceWorker")) {
          setShowInstallPrompt(true);
      } else {
          alert(`Setup Failed: ${error.message}`);
      }
      return false;
    } finally {
      setLoading(false);
    }
  };

  const unsubscribeFromPush = async () => {
    setLoading(false);
    return true;
  };

  return {
    permission,
    isSubscribed,
    loading,
    subscribeToPush,
    unsubscribeFromPush,
    checkStatus,
    showInstallPrompt, // <--- Export this new state
    setShowInstallPrompt // <--- Export setter to close modal
  };
};