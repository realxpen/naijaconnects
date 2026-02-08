import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { Megaphone, Trash2, Plus, Clock, AlertTriangle, Check, X } from 'lucide-react';
import { useToast } from './ui/ToastProvider';

const AdminBroadcasts = () => {
  const { showToast } = useToast();
  const [broadcasts, setBroadcasts] = useState<any[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  
  // Form State
  const [message, setMessage] = useState('');
  const [type, setType] = useState('info');
  const [showOnce, setShowOnce] = useState(false);
  const [hoursValid, setHoursValid] = useState(24); // Default 24 hours

  const fetchBroadcasts = async () => {
    const { data } = await supabase.from('broadcasts').select('*').order('created_at', { ascending: false });
    if (data) setBroadcasts(data);
  };

  useEffect(() => { fetchBroadcasts(); }, []);

  const handleCreate = async () => {
    if (!message) return showToast("Message required", "error");

    const endTime = new Date();
    endTime.setHours(endTime.getHours() + Number(hoursValid));

    const { error } = await supabase.from('broadcasts').insert({
      message,
      type,
      show_once: showOnce,
      end_time: endTime.toISOString()
    });

    if (error) {
        showToast(error.message, "error");
    } else {
        showToast("Broadcast Live!", "success");
        setIsCreating(false);
        setMessage('');
        fetchBroadcasts();
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this broadcast?")) return;
    await supabase.from('broadcasts').delete().eq('id', id);
    fetchBroadcasts();
  };

  const toggleActive = async (id: string, currentStatus: boolean) => {
    await supabase.from('broadcasts').update({ is_active: !currentStatus }).eq('id', id);
    fetchBroadcasts();
  };

  return (
    <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-black text-slate-800 flex items-center gap-2">
            <Megaphone className="text-blue-600"/> Broadcasts
        </h2>
        <button onClick={() => setIsCreating(!isCreating)} className="bg-slate-900 text-white p-2 rounded-full hover:bg-slate-700 transition">
            {isCreating ? <X size={20}/> : <Plus size={20}/>}
        </button>
      </div>

      {/* CREATE FORM */}
      {isCreating && (
        <div className="bg-slate-50 p-4 rounded-2xl mb-6 animate-in fade-in slide-in-from-top-2">
            <label className="text-xs font-bold text-slate-500 uppercase ml-1">Message</label>
            <textarea 
                value={message} 
                onChange={(e) => setMessage(e.target.value)}
                className="w-full p-3 rounded-xl border border-slate-200 text-sm font-medium mb-3 focus:outline-emerald-500" 
                rows={3} 
                placeholder="e.g. MTN Data is currently down..."
            />
            
            <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                    <label className="text-xs font-bold text-slate-500 uppercase ml-1">Type</label>
                    <select value={type} onChange={(e) => setType(e.target.value)} className="w-full p-3 rounded-xl border border-slate-200 text-sm font-bold bg-white">
                        <option value="info">Info (Blue)</option>
                        <option value="warning">Warning (Yellow)</option>
                        <option value="error">Error (Red)</option>
                        <option value="success">Success (Green)</option>
                    </select>
                </div>
                <div>
                    <label className="text-xs font-bold text-slate-500 uppercase ml-1">Duration (Hours)</label>
                    <input type="number" value={hoursValid} onChange={(e) => setHoursValid(Number(e.target.value))} className="w-full p-3 rounded-xl border border-slate-200 text-sm font-bold" />
                </div>
            </div>

            <div className="flex items-center gap-2 mb-4">
                <input type="checkbox" checked={showOnce} onChange={(e) => setShowOnce(e.target.checked)} id="showOnce" className="w-5 h-5 rounded text-emerald-600"/>
                <label htmlFor="showOnce" className="text-sm font-bold text-slate-700 cursor-pointer">Show only once per user?</label>
            </div>

            <button onClick={handleCreate} className="w-full bg-blue-600 text-white font-bold py-3 rounded-xl hover:bg-blue-700 transition">
                Publish Broadcast
            </button>
        </div>
      )}

      {/* LIST */}
      <div className="space-y-3">
        {broadcasts.map(b => (
            <div key={b.id} className={`p-4 rounded-2xl border flex justify-between items-center gap-3 ${b.is_active ? 'bg-white border-slate-200' : 'bg-slate-50 border-slate-100 opacity-60'}`}>
                <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${
                            b.type === 'error' ? 'bg-rose-100 text-rose-600' : 
                            b.type === 'warning' ? 'bg-amber-100 text-amber-600' : 
                            'bg-blue-100 text-blue-600'
                        }`}>{b.type}</span>
                        {!b.is_active && <span className="text-[10px] font-bold text-slate-400">INACTIVE</span>}
                    </div>
                    <p className="text-sm font-medium text-slate-700">{b.message}</p>
                    <p className="text-[10px] text-slate-400 mt-1 flex items-center gap-1">
                        <Clock size={10}/> Ends: {new Date(b.end_time).toLocaleString()}
                    </p>
                </div>
                
                <div className="flex flex-col gap-2">
                    <button onClick={() => toggleActive(b.id, b.is_active)} className={`p-2 rounded-lg transition ${b.is_active ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-200 text-slate-500'}`}>
                        {b.is_active ? <Check size={16}/> : <X size={16}/>}
                    </button>
                    <button onClick={() => handleDelete(b.id)} className="p-2 bg-rose-50 text-rose-500 rounded-lg hover:bg-rose-100 transition">
                        <Trash2 size={16}/>
                    </button>
                </div>
            </div>
        ))}
        {broadcasts.length === 0 && <p className="text-center text-slate-400 text-sm py-4">No broadcasts yet.</p>}
      </div>
    </div>
  );
};

export default AdminBroadcasts;