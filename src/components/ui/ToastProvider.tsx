import React, { createContext, useCallback, useContext, useMemo, useState } from "react";
import { CheckCircle2, AlertTriangle, Info, X } from "lucide-react";

type ToastVariant = "success" | "error" | "info";

type ToastItem = {
  id: string;
  message: string;
  variant: ToastVariant;
  duration: number;
  onRetry?: () => void;
};

type ToastOptions = {
  onRetry?: () => void;
};

type ToastContextValue = {
  showToast: (message: string, variant?: ToastVariant, duration?: number, options?: ToastOptions) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

const variantStyles: Record<ToastVariant, { wrap: string; icon: React.ReactNode; title: string }> = {
  success: {
    wrap: "bg-[#1E293B] border-[rgba(255,255,255,0.08)] text-white",
    icon: <CheckCircle2 className="text-emerald-400" size={20} />,
    title: "Success",
  },
  error: {
    wrap: "bg-[#1E293B] border-[rgba(255,255,255,0.08)] text-white",
    icon: <AlertTriangle className="text-rose-400" size={20} />,
    title: "Failed",
  },
  info: {
    wrap: "bg-[#1E293B] border-[rgba(255,255,255,0.08)] text-white",
    icon: <Info className="text-slate-300" size={20} />,
    title: "Info",
  },
};

export const ToastProvider = ({ children }: { children: React.ReactNode }) => {
  const [activeToast, setActiveToast] = useState<ToastItem | null>(null);

  const normalizeMessage = (message: string) => {
    const lower = String(message || "").toLowerCase();
    if (
      lower.includes("insufficient api balance") ||
      (lower.includes("insufficient") && lower.includes("api")) ||
      lower.includes("api balance") ||
      lower.includes("api wallet")
    ) {
      return "Swifna is temporarily unable to complete this transaction. Please try again shortly.";
    }
    return message;
  };

  const showToast = useCallback(
    (message: string, variant: ToastVariant = "info", duration = 3500, options?: ToastOptions) => {
      const id = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      const normalized = normalizeMessage(message);
      setActiveToast({ id, message: normalized, variant, duration, onRetry: options?.onRetry });
    },
    []
  );

  const value = useMemo(() => ({ showToast }), [showToast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      {activeToast && (() => {
        const v = variantStyles[activeToast.variant];
        return (
          <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/40 p-4">
            <div className={`w-full max-w-sm rounded-3xl border p-6 shadow-2xl ${v.wrap}`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {v.icon}
                  <h3 className="text-sm font-black">{v.title}</h3>
                </div>
                <button
                  onClick={() => setActiveToast(null)}
                  className="p-1 rounded-full hover:bg-white/10 transition-colors"
                  aria-label="Dismiss"
                >
                  <X size={14} />
                </button>
              </div>
              <p className="mt-4 text-xs text-slate-300 leading-relaxed">
                {activeToast.message}
              </p>
              <div className="mt-5 flex flex-col gap-2">
                <button
                  onClick={() => setActiveToast(null)}
                  className="w-full h-12 rounded-2xl bg-emerald-600 text-white text-xs font-black uppercase"
                >
                  OK
                </button>
                {activeToast.onRetry && (
                  <button
                    onClick={() => {
                      const retry = activeToast.onRetry;
                      setActiveToast(null);
                      retry?.();
                    }}
                    className="w-full text-[10px] font-black uppercase text-slate-300"
                  >
                    Retry
                  </button>
                )}
              </div>
            </div>
          </div>
        );
      })()}
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
