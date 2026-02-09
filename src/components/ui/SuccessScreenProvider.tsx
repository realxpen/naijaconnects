import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { supabase } from "../../supabaseClient";

type SuccessPayload = {
  title: string;
  amount: number;
  message?: string;
  subtitle?: string;
  onViewDetails?: () => void;
};

type Promo = {
  id: string;
  title: string;
  subtitle?: string | null;
  cta?: string | null;
  cta_url?: string | null;
  icon_url?: string | null;
};

type SuccessContextValue = {
  showSuccess: (payload: SuccessPayload) => void;
};

const SuccessContext = createContext<SuccessContextValue | null>(null);

export const SuccessScreenProvider = ({ children }: { children: React.ReactNode }) => {
  const [active, setActive] = useState<SuccessPayload | null>(null);
  const [promos, setPromos] = useState<Promo[]>([]);

  const fetchPromos = useCallback(async () => {
    const { data } = await supabase
      .from("promos")
      .select("*")
      .eq("is_active", true)
      .order("sort_order", { ascending: true });
    if (data) setPromos(data as Promo[]);
  }, []);

  useEffect(() => {
    if (active) fetchPromos();
  }, [active, fetchPromos]);

  const showSuccess = useCallback((payload: SuccessPayload) => {
    setActive(payload);
  }, []);

  const value = useMemo(() => ({ showSuccess }), [showSuccess]);

  return (
    <SuccessContext.Provider value={value}>
      {children}
      {active && (
        <div className="fixed inset-0 z-[95] bg-black/70 p-4 flex items-center justify-center">
          <div className="w-full max-w-sm rounded-3xl bg-[#1F2937] p-5 text-white shadow-2xl">
            <div className="flex items-center justify-between">
              <div />
              <button
                onClick={() => setActive(null)}
                className="text-emerald-300 text-xs font-black uppercase"
              >
                Done
              </button>
            </div>

            <div className="mt-2 flex flex-col items-center text-center">
              <div className="w-14 h-14 rounded-full bg-emerald-500 flex items-center justify-center mb-3">
                <CheckCircle2 size={28} className="text-white" />
              </div>
              <h3 className="text-lg font-black">{active.title}</h3>
              <div className="text-3xl font-black mt-2">
                ₦{Number(active.amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              {active.message && (
                <div className="mt-3 bg-white/10 rounded-2xl px-4 py-3 text-xs text-slate-200">
                  {active.message}
                </div>
              )}
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3">
              {active.onViewDetails && (
                <button
                  onClick={active.onViewDetails}
                  className="py-3 rounded-2xl bg-white/10 text-xs font-black uppercase"
                >
                  View Details
                </button>
              )}
              <button
                onClick={() => setActive(null)}
                className="py-3 rounded-2xl bg-emerald-600 text-xs font-black uppercase"
              >
                Done
              </button>
            </div>

            {promos.length > 0 && (
              <div className="mt-5 bg-[#111827] rounded-2xl p-4">
                <h4 className="text-sm font-black mb-3">Special Bonus For You</h4>
                <div className="space-y-3">
                  {promos.map((p) => (
                    <div key={p.id} className="flex items-center gap-3 bg-white/5 p-3 rounded-xl">
                      <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center overflow-hidden">
                        {p.icon_url ? <img src={p.icon_url} className="w-full h-full object-cover" /> : null}
                      </div>
                      <div className="flex-1">
                        <p className="text-xs font-black">{p.title}</p>
                        {p.subtitle && <p className="text-[10px] text-slate-300">{p.subtitle}</p>}
                      </div>
                      {p.cta && p.cta_url && (
                        <a
                          href={p.cta_url}
                          target="_blank"
                          rel="noreferrer"
                          className="px-3 py-1.5 rounded-full bg-emerald-600 text-[10px] font-black uppercase"
                        >
                          {p.cta}
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </SuccessContext.Provider>
  );
};

export const useSuccessScreen = () => {
  const ctx = useContext(SuccessContext);
  if (!ctx) throw new Error("useSuccessScreen must be used within SuccessScreenProvider");
  return ctx;
};
