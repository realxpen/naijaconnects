import React from "react";

interface ConfirmTransactionModalProps {
  open: boolean;
  title?: string;
  subtitle?: string;
  amountLabel?: string;
  amount: number;
  confirmLabel?: string;
  onConfirm: () => void;
  onClose: () => void;
}

const ConfirmTransactionModal: React.FC<ConfirmTransactionModalProps> = ({
  open,
  title = "Confirm Transaction",
  subtitle,
  amountLabel = "Total Pay",
  amount,
  confirmLabel = "Purchase Now",
  onConfirm,
  onClose,
}) => {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-sm rounded-3xl bg-[#1E293B] border border-[rgba(255,255,255,0.08)] p-6 shadow-2xl">
        <div className="flex flex-col items-center text-center">
          <div className="w-12 h-12 rounded-2xl bg-emerald-200 flex items-center justify-center mb-3">
            <div className="w-4 h-6 rounded-sm border-2 border-emerald-700" />
          </div>
          <h3 className="text-sm font-black text-white">{title}</h3>
          {subtitle && (
            <p className="text-[10px] uppercase tracking-widest text-slate-400 mt-1">{subtitle}</p>
          )}
        </div>

        <div className="mt-6 bg-[#0F172A] border border-[rgba(255,255,255,0.06)] rounded-2xl p-4 flex items-center justify-between">
          <span className="text-[10px] font-black uppercase text-slate-400">{amountLabel}</span>
          <span className="text-lg font-black text-emerald-400">
            ₦{Number(amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
        </div>

        <button
          onClick={onConfirm}
          className="mt-5 w-full h-12 rounded-2xl bg-emerald-600 text-white text-xs font-black uppercase"
        >
          {confirmLabel}
        </button>

        <button
          onClick={onClose}
          className="mt-3 w-full text-[10px] font-black uppercase text-slate-400"
        >
          Go Back
        </button>
      </div>
    </div>
  );
};

export default ConfirmTransactionModal;
