import React, { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';
import { AlertTriangle, Info, XCircle, CheckCircle, X } from 'lucide-react';

interface Broadcast {
  id: string;
  message: string;
  type: 'info' | 'warning' | 'error' | 'success';
  show_once: boolean;
}

const BroadcastManager = () => {
  const [broadcasts, setBroadcasts] = useState<Broadcast[]>([]);
  const [hiddenIds, setHiddenIds] = useState<string[]>([]);

  useEffect(() => {
    // Load dismissed IDs from local storage
    const dismissed = JSON.parse(localStorage.getItem('dismissed_broadcasts') || '[]');
    setHiddenIds(dismissed);

    const fetchBroadcasts = async () => {
      const { data } = await supabase
        .from('broadcasts')
        .select('*')
        .eq('is_active', true)
        .or(`end_time.is.null,end_time.gt.${new Date().toISOString()}`) // Only valid times
        .order('created_at', { ascending: false });

      if (data) setBroadcasts(data);
    };

    fetchBroadcasts();
  }, []);

  const dismiss = (id: string, permanent: boolean) => {
    // Hide from current view
    setBroadcasts(prev => prev.filter(b => b.id !== id));
    
    // If "Show Once", save to local storage so it never shows again
    if (permanent) {
      const newHidden = [...hiddenIds, id];
      setHiddenIds(newHidden);
      localStorage.setItem('dismissed_broadcasts', JSON.stringify(newHidden));
    }
  };

  // Filter out hidden ones
  const visibleBroadcasts = broadcasts.filter(b => !hiddenIds.includes(b.id));

  if (visibleBroadcasts.length === 0) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-[100] flex flex-col items-center gap-2 p-4 pointer-events-none">
      {visibleBroadcasts.map((b) => (
        <div 
          key={b.id} 
          className={`
            pointer-events-auto w-full max-w-md p-4 rounded-2xl shadow-xl flex items-start gap-3 animate-in slide-in-from-top-5 fade-in duration-300 border-l-4
            ${b.type === 'error' ? 'bg-white border-rose-500 text-rose-600' : 
              b.type === 'warning' ? 'bg-white border-amber-500 text-amber-600' : 
              b.type === 'success' ? 'bg-white border-emerald-500 text-emerald-600' : 
              'bg-white border-blue-500 text-blue-600'}
          `}
        >
          <div className="mt-1 shrink-0">
            {b.type === 'error' && <XCircle size={20} />}
            {b.type === 'warning' && <AlertTriangle size={20} />}
            {b.type === 'success' && <CheckCircle size={20} />}
            {b.type === 'info' && <Info size={20} />}
          </div>
          
          <div className="flex-1">
            <h4 className="font-bold text-sm uppercase mb-1">{b.type} Alert</h4>
            <p className="text-xs font-medium text-slate-600 leading-relaxed">{b.message}</p>
          </div>

          <button 
            onClick={() => dismiss(b.id, b.show_once)} 
            className="text-slate-400 hover:text-slate-600 transition-colors"
          >
            <X size={18} />
          </button>
        </div>
      ))}
    </div>
  );
};

export default BroadcastManager;