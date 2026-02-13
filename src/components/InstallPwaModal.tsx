import React from 'react';
import { Share, PlusSquare, X } from 'lucide-react';

interface InstallPwaModalProps {
  onClose: () => void;
}

const InstallPwaModal: React.FC<InstallPwaModalProps> = ({ onClose }) => {
  return (
    <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-[100] flex flex-col justify-end sm:justify-center items-center p-4 animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-sm rounded-t-[30px] sm:rounded-[30px] p-6 shadow-2xl relative">
        <button 
            onClick={onClose} 
            className="absolute top-4 right-4 p-2 bg-slate-100 rounded-full text-slate-500 hover:bg-slate-200"
        >
            <X size={20} />
        </button>

        <div className="text-center mb-6">
            <div className="w-16 h-16 bg-emerald-100 rounded-2xl mx-auto flex items-center justify-center mb-4 text-emerald-600 shadow-sm">
                <Share size={32} />
            </div>
            <h3 className="text-xl font-black text-slate-800">Enable Notifications</h3>
            <p className="text-sm text-slate-500 mt-2 font-medium">
                To receive alerts on iPhone, you must add this app to your Home Screen.
            </p>
        </div>

        <div className="space-y-4 bg-slate-50 p-4 rounded-2xl border border-slate-100">
            <div className="flex items-center gap-4">
                <div className="w-8 h-8 flex items-center justify-center bg-white rounded-lg shadow-sm text-blue-500">
                    <Share size={18} />
                </div>
                <p className="text-xs text-slate-600 font-bold">
                    1. Tap the <span className="text-slate-900 font-black">Share</span> button below.
                </p>
            </div>
            <div className="w-full h-px bg-slate-200/50"></div>
            <div className="flex items-center gap-4">
                <div className="w-8 h-8 flex items-center justify-center bg-white rounded-lg shadow-sm text-slate-700">
                    <PlusSquare size={18} />
                </div>
                <p className="text-xs text-slate-600 font-bold">
                    2. Scroll down & tap <span className="text-slate-900 font-black">Add to Home Screen</span>.
                </p>
            </div>
        </div>
        
        {/* Pointer Arrow for iOS Safari (Bottom Center) */}
        <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 translate-y-full flex flex-col items-center animate-bounce">
            <div className="w-0 h-0 border-l-[10px] border-l-transparent border-r-[10px] border-r-transparent border-t-[10px] border-t-white"></div>
        </div>
      </div>
    </div>
  );
};

export default InstallPwaModal;