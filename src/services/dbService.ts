// src/services/dbService.ts

const DB_KEY = 'naija_connect_database_v3';

const getDb = () => {
  const stored = localStorage.getItem(DB_KEY);
  if (!stored) return { profiles: [], transactions: [] };
  return JSON.parse(stored);
};

const saveDb = (data: any) => {
  localStorage.setItem(DB_KEY, JSON.stringify(data));
};

export const dbService = {
  // ... (Login/Register/Auth functions remain the same - abbreviated here for brevity) ...
  async loginUser(email: string, password: string) { 
    await new Promise(r => setTimeout(r, 800)); 
    const db = getDb();
    const user = db.profiles.find((p: any) => p.email.toLowerCase() === email.toLowerCase());
    if (!user) throw new Error("User not found.");
    if (user.password !== password) throw new Error("Incorrect password.");
    return user;
  },

  async registerUser(email: string, name: string, password: string) {
    await new Promise(r => setTimeout(r, 800));
    const db = getDb();
    if (db.profiles.find((p: any) => p.email.toLowerCase() === email.toLowerCase())) throw new Error("User already exists.");
    const newUser = { id: 'user_' + Date.now(), email: email.toLowerCase(), full_name: name, password: password, wallet_balance: 0, created_at: new Date().toISOString() };
    db.profiles.push(newUser);
    saveDb(db);
    return newUser;
  },

  async getUserProfile(email: string, nameFallback?: string) {
    const db = getDb();
    let user = db.profiles.find((p: any) => p.email.toLowerCase() === email.toLowerCase());
    if (!user && nameFallback) user = await this.registerUser(email, nameFallback, 'password123');
    return user;
  },

  // --- 🆕 TRANSACTION HANDLERS (Fixing Deposit/Withdraw) ---

  async updateBalance(email: string, newBalance: number) {
    const db = getDb();
    const idx = db.profiles.findIndex((p: any) => p.email.toLowerCase() === email.toLowerCase());
    if (idx !== -1) { 
        db.profiles[idx].wallet_balance = newBalance; 
        saveDb(db); 
    }
  },

  // Helper to record a transaction
  async addTransaction(tx: { user_email: string; type: string; amount: number; phoneNumber?: string; status: string; carrier?: string }) {
    const db = getDb();
    db.transactions.push({ 
        ...tx, 
        id: 'tx_' + Date.now(), 
        created_at: new Date().toISOString() 
    });
    saveDb(db);
  },

  // Get History
  async getHistory(email: string) {
    await new Promise(r => setTimeout(r, 500));
    const db = getDb();
    const userTx = db.transactions
      .filter((t: any) => t.user_email.toLowerCase() === email.toLowerCase())
      .sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    
    return userTx.map((t: any) => ({
      id: t.id,
      date: new Date(t.created_at).toLocaleString(),
      carrier: t.carrier || (t.type === 'Deposit' ? 'Wallet' : 'System'),
      type: t.type,
      amount: Number(t.amount),
      phoneNumber: t.phoneNumber || t.user_email,
      status: t.status || 'Success'
    }));
  }
};