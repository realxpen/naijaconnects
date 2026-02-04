import React, { createContext, useCallback, useContext, useMemo, useState } from "react";
import { CheckCircle2, AlertTriangle, Info, X } from "lucide-react";

type ToastVariant = "success" | "error" | "info";

type ToastItem = {
  id: string;
  message: string;
  variant: ToastVariant;
  duration: number;
};

type ToastContextValue = {
  showToast: (message: string, variant?: ToastVariant, duration?: number) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

const variantStyles: Record<ToastVariant, { wrap: string; icon: React.ReactNode }> = {
  success: {
    wrap: "border-emerald-200 bg-emerald-50 text-emerald-800",
    icon: <CheckCircle2 className="text-emerald-600" size={18} />,
  },
  error: {
    wrap: "border-rose-200 bg-rose-50 text-rose-800",
    icon: <AlertTriangle className="text-rose-600" size={18} />,
  },
  info: {
    wrap: "border-slate-200 bg-white text-slate-800",
    icon: <Info className="text-slate-600" size={18} />,
  },
};

export const ToastProvider = ({ children }: { children: React.ReactNode }) => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const showToast = useCallback(
    (message: string, variant: ToastVariant = "info", duration = 3500) => {
      const id = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      setToasts((prev) => [...prev, { id, message, variant, duration }]);
      window.setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, duration);
    },
    []
  );

  const value = useMemo(() => ({ showToast }), [showToast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="fixed top-4 right-4 z-[80] flex flex-col gap-3 w-[92vw] max-w-sm">
        {toasts.map((t) => {
          const v = variantStyles[t.variant];
          return (
            <div
              key={t.id}
              className={`border shadow-lg rounded-2xl px-4 py-3 flex items-start gap-3 animate-in slide-in-from-top-2 ${v.wrap}`}
            >
              <div className="mt-0.5">{v.icon}</div>
              <div className="text-sm font-bold leading-snug flex-1">{t.message}</div>
              <button
                onClick={() => setToasts((prev) => prev.filter((x) => x.id !== t.id))}
                className="p-1 rounded-full hover:bg-black/5 transition-colors"
                aria-label="Dismiss"
              >
                <X size={14} />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error("useToast must be used within ToastProvider");
  }
  return ctx;
};
