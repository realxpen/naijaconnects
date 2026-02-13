import { useState, useEffect } from "react";
import { supabase } from "../supabaseClient";

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY as string;

// Helper to check if running as PWA (Installed)
const isStandalone = () => {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as any).standalone === true
  );
};

// Helper to check if device is iOS
const isIOS = () => {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
};

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
  const [showInstallPrompt, setShowInstallPrompt] = useState(false);

  // 1. Check Status
  const checkStatus = async () => {
    // If we are on iOS and NOT installed, we can't check permission yet
    if (isIOS() && !isStandalone()) {
       setPermission("default");
       return;
    }

    if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;
    
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

  // 2. Subscribe (The Button Click)
  const subscribeToPush = async () => {
    // A. DETECT IOS BROWSER (The fix for "Nothing happens")
    // If it's an iPhone/iPad AND it is NOT on the Home Screen yet...
    if (isIOS() && !isStandalone()) {
      console.log("iOS Browser detected. Showing Install Prompt.");
      setShowInstallPrompt(true); // <--- This forces the modal to open
      return false;
    }

    // A2. Check Vercel Key
    if (!VAPID_PUBLIC_KEY) {
      alert("System Error: VITE_VAPID_PUBLIC_KEY is missing.");
      return false;
    }

    if (!userId) {
      alert("Please log in to enable notifications.");
      return false;
    }

    setLoading(true);
    try {
      if (!("serviceWorker" in navigator)) {
         // Fallback for non-iOS browsers that don't support SW
         alert("Your browser does not support notifications.");
         return false;
      }

      console.log("Registering SW...");
      const registration = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;

      const result = await Notification.requestPermission();
      setPermission(result);
      
      if (result !== "granted") {
        alert("Permission denied. You must allow notifications in settings.");
        setLoading(false);
        return false;
      }

      console.log("Subscribing...");
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      });

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
      // If error is specifically about service worker support, show prompt
      if (error.message && (error.message.includes("serviceWorker") || error.message.includes("PushManager"))) {
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
    // Add logic here if needed
    return true;
  };

  return {
    permission,
    isSubscribed,
    loading,
    subscribeToPush,
    unsubscribeFromPush,
    checkStatus,
    showInstallPrompt,
    setShowInstallPrompt
  };
};