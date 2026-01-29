import React, { useState } from 'react';
import { Zap, User as UserIcon, Mail, Lock, LogIn, UserPlus, Loader2 } from 'lucide-react';
import { dbService } from '../services/dbService';

interface AuthProps {
  onLogin: (email: string, pass: string) => Promise<void>;
  onSignup: (email: string, name: string, pass: string) => Promise<void>;
  isProcessing: boolean;
}

type AuthView = 'login' | 'signup' | 'forgot-password';

const Auth: React.FC<AuthProps> = ({ onLogin, onSignup, isProcessing }) => {
  const [view, setView] = useState<AuthView>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (view === 'login') {
      try {
        await onLogin(email, password);
      } catch (err: any) {
        alert(err.message || "Login failed. Please check your credentials.");
      }
    } else {
      // ✅ FIXED SIGNUP FLOW
      try {
        await onSignup(email, name, password);
        // Show success message and prevent automatic dashboard jump
        alert("Signup Successful! Please check your email to verify your account before logging in.");
        
        // Reset state and move back to login view
        setView('login');
        setPassword('');
        // Optional: window.location.reload(); 
      } catch (err: any) {
        alert(err.message || "Signup Failed. This email might already be in use.");
      }
    }
  };

  const handleForgotPassword = async () => {
    const emailPrompt = prompt("Enter your email to receive a reset link:");
    if (emailPrompt) {
      try {
        await dbService.resetPasswordEmail(emailPrompt);
        alert("Reset link sent to your email! Please check your inbox.");
      } catch (e: any) {
        alert(e.message || "Error sending reset link.");
      }
    }
  };

  return (
    <div className="min-h-screen flex flex-col max-w-lg mx-auto bg-slate-50 dark:bg-slate-900 p-6 justify-center">
      <div className="text-center mb-8">
        <div className="bg-emerald-600 w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
          <Zap className="w-10 h-10 text-yellow-400 fill-yellow-400"/>
        </div>
        <h2 className="text-3xl font-black dark:text-white tracking-tight">
          {view === 'login' ? 'Welcome Back' : 'Create Account'}
        </h2>
        <p className="text-slate-400 text-sm font-bold uppercase tracking-wider mt-1">
          {view === 'login' ? 'Sign in to continue' : 'Join NaijaConnect Today'}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {view === 'signup' && (
          <div className="relative">
            <UserIcon className="absolute left-3 top-4 text-slate-400" size={18} />
            <input type="text" required placeholder="Full Name" value={name} onChange={e => setName(e.target.value)} className="w-full pl-10 p-4 rounded-xl border dark:bg-slate-950 dark:text-white font-bold outline-none focus:ring-2 focus:ring-emerald-500" />
          </div>
        )}
        <div className="relative">
          <Mail className="absolute left-3 top-4 text-slate-400" size={18} />
          <input type="email" required placeholder="Email Address" value={email} onChange={e => setEmail(e.target.value)} className="w-full pl-10 p-4 rounded-xl border dark:bg-slate-950 dark:text-white font-bold outline-none focus:ring-2 focus:ring-emerald-500" />
        </div>
        <div className="relative">
          <Lock className="absolute left-3 top-4 text-slate-400" size={18} />
          <input type="password" required placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} className="w-full pl-10 p-4 rounded-xl border dark:bg-slate-950 dark:text-white font-bold outline-none focus:ring-2 focus:ring-emerald-500" />
        </div>

        {view === 'login' && (
          <button 
            type="button"
            onClick={handleForgotPassword}
            className="text-[10px] font-black text-emerald-600 uppercase tracking-widest mt-2 block ml-auto hover:text-emerald-700 transition-colors"
          >
            Forgot Password?
          </button>
        )}
        
        <button type="submit" disabled={isProcessing} className="w-full py-4 bg-emerald-600 text-white rounded-2xl font-black shadow-lg uppercase tracking-tight flex justify-center items-center gap-2 hover:bg-emerald-700 active:scale-95 transition-all">
          {isProcessing ? <Loader2 className="animate-spin" /> : (view === 'login' ? <><LogIn size={18} /> Sign In</> : <><UserPlus size={18} /> Sign Up</>)}
        </button>
      </form>

      <div className="text-center mt-6">
        {view === 'login' ? (
          <button onClick={() => setView('signup')} className="text-emerald-600 font-black uppercase tracking-wider text-sm hover:underline">Create Account</button>
        ) : (
          <button onClick={() => setView('login')} className="text-emerald-600 font-black uppercase tracking-wider text-sm hover:underline">Back to Login</button>
        )}
      </div>
    </div>
  );
};

export default Auth;