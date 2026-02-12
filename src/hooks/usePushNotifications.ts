import { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined;

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

  const checkStatus = async () => {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;
    setPermission(Notification.permission);
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      setIsSubscribed(!!subscription);
    } catch {
      setIsSubscribed(false);
    }
  };

  useEffect(() => {
    checkStatus();
  }, [userId]);

  const subscribeToPush = async () => {
    if (!userId || !VAPID_PUBLIC_KEY) return false;
    setLoading(true);
    try {
      const result = await Notification.requestPermission();
      setPermission(result);
      if (result !== "granted") return false;

      const registration = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      });

      const subscriptionData = subscription.toJSON();
      const endpoint = subscriptionData.endpoint;
      const p256dh = subscriptionData.keys?.p256dh || "";
      const auth = subscriptionData.keys?.auth || "";
      if (!endpoint || !p256dh || !auth) return false;

      const { error } = await supabase
        .from("push_subscriptions")
        .upsert(
          {
            user_id: userId,
            subscription: subscriptionData,
            user_agent: navigator.userAgent,
            endpoint,
            p256dh,
            auth,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "endpoint" }
        );
      if (error) throw error;

      setIsSubscribed(true);
      return true;
    } catch {
      return false;
    } finally {
      setLoading(false);
    }
  };

  const unsubscribeFromPush = async () => {
    setLoading(true);
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      if (subscription) {
        const json = subscription.toJSON();
        const endpoint = json.endpoint;
        await subscription.unsubscribe();
        if (endpoint) {
          await supabase.from("push_subscriptions").delete().eq("endpoint", endpoint);
        }
      }
      setIsSubscribed(false);
      return true;
    } catch {
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
