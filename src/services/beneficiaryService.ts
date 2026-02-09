import { supabase } from '../supabaseClient';

export type BeneficiaryType = 'airtime' | 'data' | 'cable' | 'electricity' | 'withdraw';

export interface Beneficiary {
  id: string;
  user_id: string;
  type: BeneficiaryType;
  beneficiary_key: string;
  phone_number?: string | null;
  network?: number | null;
  account_number?: string | null;
  bank_code?: string | null;
  account_name?: string | null;
  smart_card_number?: string | null;
  provider?: string | null;
  meter_number?: string | null;
  disco?: string | null;
  meter_type?: string | null;
  created_at?: string;
  last_used_at?: string;
}

export const beneficiaryService = {
  async upsert(b: Omit<Beneficiary, 'id'>) {
    const payload = {
      ...b,
      last_used_at: new Date().toISOString()
    };
    const { data, error } = await supabase
      .from('beneficiaries')
      .upsert(payload, { onConflict: 'user_id,type,beneficiary_key' })
      .select()
      .single();
    if (error) throw error;
    return data as Beneficiary;
  },

  async fetchRecent(userId: string, type: BeneficiaryType, limit = 5) {
    const { data, error } = await supabase
      .from('beneficiaries')
      .select('*')
      .eq('user_id', userId)
      .eq('type', type)
      .order('last_used_at', { ascending: false })
      .limit(limit);
    if (error) throw error;
    return (data || []) as Beneficiary[];
  }
};
