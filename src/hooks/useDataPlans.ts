import { useState, useEffect } from 'react';
import { airtimeService } from '../services/airtimeService';
import { DataPlan } from '../types';

export const useDataPlans = (networkId: number | null) => {
  const [plans, setPlans] = useState<DataPlan[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // If no network is selected, don't attempt to fetch/filter
    if (!networkId) {
      setPlans([]);
      return;
    }

    const fetchPlans = async () => {
      setLoading(true);
      setError(null);
      try {
        // 1. Fetch ALL plans from the new Affatech API service
        const allPlans = await airtimeService.getAllDataPlans();
        
        // 2. Filter locally for the selected network (e.g., MTN=1, GLO=2, etc.)
        // We use Number() to ensure type safety during comparison
        const networkSpecificPlans = allPlans.filter(
          (p) => Number(p.network) === networkId
        );
        
        setPlans(networkSpecificPlans);
      } catch (err) {
        console.error("Failed to load plans:", err);
        setError("Could not retrieve data plans. Please try again.");
        setPlans([]);
      } finally {
        setLoading(false);
      }
    };

    fetchPlans();
  }, [networkId]); // Re-runs whenever the user switches networks

  return { plans, loading, error };
};