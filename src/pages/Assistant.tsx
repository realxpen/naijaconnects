import React, { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, Sparkles, MoreHorizontal } from 'lucide-react';
import { geminiService } from '../services/geminiService';
import { ChatMessage } from '../types';
import { useI18n } from '../i18n';

interface AssistantProps {
  user: { name: string; email: string; balance: number };
}

const Assistant: React.FC<AssistantProps> = ({ user }) => {
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const { t, language } = useI18n();

  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: 'model', text: t("assistant.greeting", { name: user.name }) }
  ]);

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isTyping]);

  // Update greeting when language changes
  useEffect(() => {
    setMessages(prev => {
      if (prev.length === 0) {
        return [{ role: "model", text: t("assistant.greeting", { name: user.name }) }];
      }
      const [first, ...rest] = prev;
      if (first.role !== "model") return prev;
      return [{ ...first, text: t("assistant.greeting", { name: user.name }) }, ...rest];
    });
  }, [t, user.name]);

  const handleSend = async (textOverride?: string) => {
    const textToSend = textOverride || input;
    if (!textToSend.trim()) return;

    // 1. Add User Message
    const newMsg: ChatMessage = { role: 'user', text: textToSend };
    setMessages(prev => [...prev, newMsg]);
    setInput('');
    setIsTyping(true);

    // 2. Get AI Response
    try {
      const responseText = await geminiService.generateResponse(textToSend, user, language);
      
      const aiMsg: ChatMessage = { role: 'model', text: responseText };
      setMessages(prev => [...prev, aiMsg]);
    } catch (error) {
      setMessages(prev => [...prev, { role: 'model', text: t("assistant.offline") }]);
    } finally {
      setIsTyping(false);
    }
  };

  const QuickPrompt = ({ text }: { text: string }) => (
    <button 
      onClick={() => handleSend(text)}
      className="px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-full text-[10px] font-black uppercase whitespace-nowrap border border-slate-200 dark:border-slate-700 hover:bg-emerald-50 hover:text-emerald-600 hover:border-emerald-200 transition-colors"
    >
      {text}
    </button>
  );

  return (
    <div className="flex flex-col h-[calc(100vh-140px)] animate-in fade-in slide-in-from-bottom-4">
      
      {/* HEADER */}
      <div className="bg-white dark:bg-slate-800 p-4 rounded-t-[30px] border-b border-slate-100 dark:border-slate-700 flex items-center gap-3 shadow-sm">
        <div className="w-10 h-10 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center">
          <Sparkles size={20} className="animate-pulse"/>
        </div>
        <div>
           <h2 className="font-black text-sm dark:text-white uppercase tracking-tight">{t("assistant.title")}</h2>
           <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{t("assistant.subtitle")}</p>
        </div>
      </div>

      {/* CHAT AREA */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50 dark:bg-slate-900 custom-scrollbar">
         {messages.map((msg, idx) => (
           <div key={idx} className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
              <div className={`w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center ${msg.role === 'user' ? 'bg-slate-200 text-slate-500' : 'bg-emerald-600 text-white'}`}>
                 {msg.role === 'user' ? <User size={14}/> : <Bot size={14}/>}
              </div>
              <div className={`max-w-[80%] p-4 rounded-2xl text-sm font-medium leading-relaxed shadow-sm ${
                msg.role === 'user' 
                  ? 'bg-white dark:bg-slate-800 text-slate-800 dark:text-white rounded-tr-none' 
                  : 'bg-emerald-600 text-white rounded-tl-none'
              }`}>
                 {msg.text}
              </div>
           </div>
         ))}
         
         {isTyping && (
           <div className="flex gap-3">
              <div className="w-8 h-8 rounded-full bg-emerald-600 text-white flex items-center justify-center">
                 <Bot size={14}/>
              </div>
              <div className="bg-emerald-600 p-4 rounded-2xl rounded-tl-none flex items-center gap-1 h-12">
                 <div className="w-2 h-2 bg-white rounded-full animate-bounce"></div>
                 <div className="w-2 h-2 bg-white rounded-full animate-bounce [animation-delay:0.2s]"></div>
                 <div className="w-2 h-2 bg-white rounded-full animate-bounce [animation-delay:0.4s]"></div>
              </div>
           </div>
         )}
      </div>

      {/* INPUT AREA */}
      <div className="bg-white dark:bg-slate-800 p-4 rounded-b-[30px] shadow-lg border-t border-slate-100 dark:border-slate-700 space-y-3">
         
         {/* Quick Prompts Scroll */}
         <div className="flex gap-2 overflow-x-auto pb-2 custom-scrollbar">
            <QuickPrompt text={t("assistant.quick.balance")} />
            <QuickPrompt text={t("assistant.quick.deposit")} />
            <QuickPrompt text={t("assistant.quick.buy_data")} />
            <QuickPrompt text={t("assistant.quick.who")} />
         </div>

         <div className="relative">
            <input 
              type="text" 
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
              placeholder={t("assistant.input_placeholder")} 
              className="w-full pl-5 pr-14 py-4 bg-slate-100 dark:bg-slate-900 rounded-2xl font-bold text-sm outline-none focus:ring-2 focus:ring-emerald-500 transition-all dark:text-white"
            />
            <button 
              onClick={() => handleSend()}
              disabled={!input.trim() || isTyping}
              className="absolute right-2 top-2 bottom-2 aspect-square bg-emerald-600 text-white rounded-xl flex items-center justify-center disabled:opacity-50 hover:bg-emerald-700 transition-colors"
            >
              <Send size={18} />
            </button>
         </div>
      </div>
    </div>
  );
};

export default Assistant;
