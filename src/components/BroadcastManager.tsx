import React, { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';
import { AlertTriangle, Info, XCircle, CheckCircle, X } from 'lucide-react';

interface Broadcast {
  id: string;
  message: string;
  type: 'info' | 'warning' | 'error' | 'success';
  show_once: boolean;
  duration?: number;
  rank?: number; // Added rank
}

const BroadcastItem = ({ 
  data, 
  onDismiss 
}: { 
  data: Broadcast; 
  onDismiss: (id: string, permanent: boolean) => void 
}) => {
  const [isPaused, setIsPaused] = useState(false);
  const durationSeconds = data.duration || 10;
  const durationMs = durationSeconds * 1000;

  useEffect(() => {
    if (isPaused) return;
    const timer = setTimeout(() => onDismiss(data.id, data.show_once), durationMs);
    return () => clearTimeout(timer);
  }, [data.id, data.show_once, durationMs, onDismiss, isPaused]);

  return (
    <div 
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      className={`
        pointer-events-auto w-full max-w-md p-4 rounded-2xl shadow-2xl flex items-start gap-3 
        animate-in slide-in-from-top-5 fade-in duration-500 border-l-4 relative overflow-hidden group mb-2
        ${data.type === 'error' ? 'bg-white border-rose-500 text-rose-600' : 
          data.type === 'warning' ? 'bg-white border-amber-500 text-amber-600' : 
          data.type === 'success' ? 'bg-white border-emerald-500 text-emerald-600' : 
          'bg-white border-blue-500 text-blue-600'}
      `}
    >
      <div 
        className={`absolute bottom-0 left-0 h-1 bg-current opacity-20 transition-all ease-linear w-full ${isPaused ? 'w-full' : 'w-0'}`} 
        style={{ transitionDuration: `${durationMs}ms`, transitionProperty: isPaused ? 'none' : 'width' }}
      ></div>

      <div className="mt-1 shrink-0">
        {data.type === 'error' && <XCircle size={20} />}
        {data.type === 'warning' && <AlertTriangle size={20} />}
        {data.type === 'success' && <CheckCircle size={20} />}
        {data.type === 'info' && <Info size={20} />}
      </div>
      
      <div className="flex-1">
        <h4 className="font-bold text-sm uppercase mb-1">{data.type} Alert</h4>
        <p className="text-xs font-medium text-slate-700 leading-relaxed">{data.message}</p>
      </div>

      <button aria-label="Dismiss broadcast" onClick={() => onDismiss(data.id, data.show_once)} className="text-slate-400 hover:text-slate-600 transition-colors p-1 bg-slate-50 rounded-full">
        <X size={14} />
      </button>
    </div>
  );
};

const BroadcastManager = () => {
  const [broadcasts, setBroadcasts] = useState<Broadcast[]>([]);
  const [hiddenIds, setHiddenIds] = useState<string[]>([]);

  useEffect(() => {
    const dismissed = JSON.parse(localStorage.getItem('dismissed_broadcasts') || '[]');
    setHiddenIds(dismissed);

    const fetchBroadcasts = async () => {
      const { data } = await supabase
        .from('broadcasts')
        .select('*')
        .eq('is_active', true)
        .or(`end_time.is.null,end_time.gt.${new Date().toISOString()}`)
        // Order by Rank (1, 2, 3) then created_at
        .order('rank', { ascending: true }) 
        .order('created_at', { ascending: false });

      if (data) setBroadcasts(data);
    };

    fetchBroadcasts();
    const interval = window.setInterval(fetchBroadcasts, 45000);
    return () => window.clearInterval(interval);
  }, []);

  const handleDismiss = (id: string, permanent: boolean) => {
    // Remove from local state
    setBroadcasts(prev => prev.filter(b => b.id !== id));
    
    if (permanent) {
      const newHidden = [...hiddenIds, id];
      setHiddenIds(newHidden);
      localStorage.setItem('dismissed_broadcasts', JSON.stringify(newHidden));
    }
  };

  const visibleBroadcasts = broadcasts.filter(b => !hiddenIds.includes(b.id));

  // --- QUEUE LOGIC: Only show the FIRST item ---
  if (visibleBroadcasts.length === 0) return null;
  const currentBroadcast = visibleBroadcasts[0]; // <--- Only take index 0

  return (
    <div className="fixed top-4 left-0 right-0 z-[100] flex flex-col items-center gap-2 p-4 pointer-events-none">
        {/* Render ONLY the first item in the queue */}
        <BroadcastItem 
            key={currentBroadcast.id} // Key ensures React remounts timer for next item
            data={currentBroadcast} 
            onDismiss={handleDismiss} 
        />
    </div>
  );
};

export default BroadcastManager;
