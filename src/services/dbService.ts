import { supabase } from '../supabaseClient';

export const dbService = {
  // --- 1. AUTHENTICATION ---

  async loginUser(email: string, pass: string) {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password: pass,
    });
    if (error) throw error;
    return data.user;
  },

  async registerUser(email: string, name: string, pass: string) {
    // 1. Sign up the user in Supabase Auth
    const { data, error } = await supabase.auth.signUp({
      email,
      password: pass,
      options: { data: { full_name: name } }
    });
    if (error) throw error;

    // 2. Create the profile row in your 'profiles' table
    if (data.user) {
      await this.createProfile({ 
        id: data.user.id, 
        email, 
        name 
      });
    }
    return data.user;
  },

  async resetPasswordEmail(email: string) {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin + '/reset-password',
    });
    if (error) throw error;
    return true;
  },

  // --- 2. PROFILE & WALLET ---

  async getUserProfile(email: string) {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('email', email)
      .single();

    if (error && error.code !== 'PGRST116') { // PGRST116 is "no rows found"
      console.error("Error fetching profile:", error);
      return null;
    }
    return data;
  },

  async createProfile(user: { email: string, name: string, id: string }) {
    const { data, error } = await supabase
      .from('profiles')
      .insert([{ 
        id: user.id, 
        email: user.email, 
        full_name: user.name, 
        wallet_balance: 0 
      }])
      .select()
      .single();
        
    if (error) throw error;
    return data;
  },

  async getBalance(email: string) {
    const { data, error } = await supabase
      .from('profiles')
      .select('wallet_balance')
      .eq('email', email)
      .single();
      
    if (error) throw new Error(error.message);
    return data.wallet_balance;
  },

  async updateBalance(email: string, newBalance: number) {
    const { error } = await supabase
      .from('profiles')
      .update({ wallet_balance: newBalance })
      .eq('email', email);

    if (error) throw new Error("Failed to update ledger: " + error.message);
  },

  // --- 3. HISTORY ---

  async addTransaction(tx: any) {
    const { error } = await supabase
      .from('transactions')
      .insert([{
        user_email: tx.user_email,
        type: tx.type,
        amount: tx.amount,
        status: tx.status,
        reference: tx.ref || 'TX-' + Date.now(),
        metadata: tx 
      }]);

    if (error) console.error("Failed to log transaction:", error);
  },

  async getHistory(email: string) {
    const { data, error } = await supabase
      .from('transactions')
      .select('*')
      .eq('user_email', email)
      .order('created_at', { ascending: false });

    if (error) return [];
    
    return data.map((t: any) => ({
      id: t.id,
      date: new Date(t.created_at).toLocaleString(),
      type: t.type,
      amount: t.amount,
      status: t.status,
      carrier: t.metadata?.carrier || 'System',
      phoneNumber: t.metadata?.phoneNumber || 'N/A'
    }));
  }
};