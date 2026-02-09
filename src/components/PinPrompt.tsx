import React, { useState } from 'react';
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

  if (!open) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValidPin(pin, requiredLength)) return;
    onConfirm(pin);
    setPin('');
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-sm rounded-2xl bg-[#151A21] border border-[rgba(255,255,255,0.06)] p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-bold text-white">Enter PIN</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-white">
            <X size={16} />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-3">
          <input
            type="password"
            inputMode="numeric"
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, requiredLength || 6))}
            placeholder={requiredLength ? `${requiredLength}-digit PIN` : '4 or 6 digit PIN'}
            className="w-full p-4 rounded-xl bg-[#151A21] border border-[rgba(255,255,255,0.06)] text-white outline-none"
          />
          {error && <p className="text-[10px] text-rose-400 font-bold uppercase">{error}</p>}
          <button
            type="submit"
            className="w-full h-12 rounded-[14px] bg-gradient-to-r from-[#22C55E] to-[#16A34A] text-white text-sm font-semibold"
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
