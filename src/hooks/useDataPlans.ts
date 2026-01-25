import { useState, useEffect, useMemo } from 'react';
import { airtimeService } from '../services/airtimeService';
import { DataPlan } from '../types';

export const useDataPlans = (selectedNetworkId: number | null) => {
  const [plans, setPlans] = useState<DataPlan[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchPlans = async () => {
      try {
        setLoading(true);
        // Assuming the API returns the array directly or inside a 'data' property
        // Adjust this line based on the actual raw response structure
        const response: any = await airtimeService.getDataPlans(); 
        
        // Safety check: Ensure we have an array
        const allPlans = Array.isArray(response) ? response : (response.data || []);
        setPlans(allPlans);
      } catch (err) {
        console.error(err);
        setError('Failed to load data plans');
      } finally {
        setLoading(false);
      }
    };

    fetchPlans();
  }, []);

  // Filter plans automatically when the selectedNetworkId changes
  const filteredPlans = useMemo(() => {
    if (!selectedNetworkId) return [];
    return plans.filter(plan => plan.network === selectedNetworkId);
  }, [plans, selectedNetworkId]);

  // Optional: Group by Plan Type (SME, Gifting, Corporate)
  const groupedPlans = useMemo(() => {
    return {
      SME: filteredPlans.filter(p => p.plan_type.toUpperCase().includes('SME')),
      Gifting: filteredPlans.filter(p => p.plan_type.toUpperCase().includes('GIFTING')),
      Corporate: filteredPlans.filter(p => p.plan_type.toUpperCase().includes('CORPORATE')),
      Others: filteredPlans.filter(p => 
        !p.plan_type.toUpperCase().includes('SME') && 
        !p.plan_type.toUpperCase().includes('GIFTING') &&
        !p.plan_type.toUpperCase().includes('CORPORATE')
      )
    };
  }, [filteredPlans]);

  return { 
    plans: filteredPlans, // The simple list for the current network
    groupedPlans,         // The categorized list (great for tabs)
    loading, 
    error 
  };
};