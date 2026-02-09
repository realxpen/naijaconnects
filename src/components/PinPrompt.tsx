import React, { useMemo, useState } from 'react';
import { X } from 'lucide-react';
import { isValidPin } from '../utils/pin';

interface PinPromptProps {
  open: boolean;
  requiredLength: number | null;
  onConfirm: (pin: string) => void;
  onClose: () => void;
  error?: string;
}

const PinPrompt: React.FC<PinPromptProps> = ({ open, requiredLength, onConfirm, onClose, error }) => {
  const [pin, setPin] = useState('');

  const maxLen = useMemo(() => {
    if (requiredLength === 4 || requiredLength === 6) return requiredLength;
    return 6;
  }, [requiredLength]);

  if (!open) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValidPin(pin, requiredLength)) return;
    onConfirm(pin);
    setPin('');
  };

  const handleDigit = (d: string) => {
    if (pin.length >= maxLen) return;
    setPin((p) => (p + d).slice(0, maxLen));
  };

  const handleBackspace = () => {
    if (!pin.length) return;
    setPin((p) => p.slice(0, -1));
  };

  const handleClear = () => setPin('');

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-sm rounded-3xl bg-[#2B2B2B] border border-black/40 p-5 shadow-2xl">
        <div className="flex items-center justify-between mb-4">
          <button onClick={onClose} className="text-slate-300 hover:text-white">
            <X size={18} />
          </button>
          <h3 className="text-sm font-black text-white">Enter Payment PIN</h3>
          <button onClick={handleClear} className="text-[10px] font-black uppercase text-slate-400">
            Clear
          </button>
        </div>

        <div className="flex items-center justify-center gap-3 mb-4">
          {Array.from({ length: maxLen }).map((_, i) => {
            const filled = i < pin.length;
            const active = i === pin.length;
            return (
              <div
                key={`pin-${i}`}
                className={`w-12 h-12 rounded-xl flex items-center justify-center text-lg font-black
                  ${filled ? 'bg-[#111111] text-emerald-300' : 'bg-[#1C1C1C] text-transparent'}
                  ${active ? 'ring-2 ring-emerald-500' : 'ring-1 ring-black/40'}
                `}
              >
                {filled ? "•" : ""}
              </div>
            );
          })}
        </div>

        {error && <p className="text-[10px] text-rose-400 font-bold uppercase text-center mb-2">{error}</p>}

        <button className="w-full text-[11px] font-bold text-emerald-400 uppercase mb-3">
          Forgot Payment PIN?
        </button>

        <form onSubmit={handleSubmit}>
          <div className="text-[10px] text-center text-slate-400 mb-2">Secure Numeric Keypad</div>
          <div className="grid grid-cols-3 gap-2">
            {["1","2","3","4","5","6","7","8","9"].map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => handleDigit(d)}
                className="h-12 rounded-xl bg-[#3A3A3A] text-white text-lg font-black active:scale-95"
              >
                {d}
              </button>
            ))}
            <button
              type="button"
              onClick={handleClear}
              className="h-12 rounded-xl bg-[#3A3A3A] text-white text-xs font-black uppercase"
            >
              Clear
            </button>
            <button
              type="button"
              onClick={() => handleDigit("0")}
              className="h-12 rounded-xl bg-[#3A3A3A] text-white text-lg font-black active:scale-95"
            >
              0
            </button>
            <button
              type="button"
              onClick={handleBackspace}
              className="h-12 rounded-xl bg-[#3A3A3A] text-white text-lg font-black active:scale-95"
            >
              ×
            </button>
          </div>

          <button
            type="submit"
            className="mt-4 w-full h-12 rounded-2xl bg-emerald-600 text-white text-xs font-black uppercase"
            disabled={!isValidPin(pin, requiredLength)}
          >
            Confirm PIN
          </button>
        </form>
      </div>
    </div>
  );
};

export default PinPrompt;
