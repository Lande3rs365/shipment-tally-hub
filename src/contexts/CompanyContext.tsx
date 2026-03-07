import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import type { Company } from "@/types/database";

interface CompanyContextType {
  companies: Company[];
  currentCompany: Company | null;
  setCurrentCompany: (company: Company) => void;
  loading: boolean;
}

const CompanyContext = createContext<CompanyContextType>({
  companies: [],
  currentCompany: null,
  setCurrentCompany: () => {},
  loading: true,
});

export const useCompany = () => useContext(CompanyContext);

export function CompanyProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [currentCompany, setCurrentCompany] = useState<Company | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setCompanies([]);
      setCurrentCompany(null);
      setLoading(false);
      return;
    }

    async function fetchCompanies() {
      // Get user's company IDs
      const { data: memberships } = await (supabase as any)
        .from('user_companies')
        .select('company_id')
        .eq('user_id', user!.id);

      if (!memberships || memberships.length === 0) {
        setCompanies([]);
        setCurrentCompany(null);
        setLoading(false);
        return;
      }

      const companyIds = memberships.map((m: any) => m.company_id);
      const { data: companyData } = await (supabase as any)
        .from('companies')
        .select('*')
        .in('id', companyIds);

      const list = (companyData || []) as Company[];
      setCompanies(list);

      // Restore last selected or use first
      const savedId = localStorage.getItem('distrohub_company_id');
      const saved = list.find(c => c.id === savedId);
      setCurrentCompany(saved || list[0] || null);
      setLoading(false);
    }

    fetchCompanies();
  }, [user]);

  const handleSetCompany = (company: Company) => {
    setCurrentCompany(company);
    localStorage.setItem('distrohub_company_id', company.id);
  };

  return (
    <CompanyContext.Provider value={{ companies, currentCompany, setCurrentCompany: handleSetCompany, loading }}>
      {children}
    </CompanyContext.Provider>
  );
}
