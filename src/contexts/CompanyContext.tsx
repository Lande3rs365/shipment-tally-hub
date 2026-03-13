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
  const { user, loading: authLoading } = useAuth();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [currentCompany, setCurrentCompany] = useState<Company | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading) {
      setLoading(true);
      return;
    }

    if (!user) {
      setCompanies([]);
      setCurrentCompany(null);
      setLoading(false);
      return;
    }

    let isActive = true;

    async function fetchCompanies() {
      setLoading(true);

      const { data: memberships } = await supabase
        .from("user_companies")
        .select("company_id")
        .eq("user_id", user.id);

      if (!isActive) return;

      if (!memberships || memberships.length === 0) {
        setCompanies([]);
        setCurrentCompany(null);
        setLoading(false);
        return;
      }

      const companyIds = memberships.map((m) => m.company_id);
      const { data: companyData } = await supabase
        .from("companies")
        .select("*")
        .in("id", companyIds);

      if (!isActive) return;

      const list = (companyData || []) as Company[];
      setCompanies(list);

      const savedId = localStorage.getItem("fulfillmate_company_id")
        ?? localStorage.getItem("distrohub_company_id"); // migrate old key
      const saved = list.find(c => c.id === savedId);
      setCurrentCompany(saved || list[0] || null);
      setLoading(false);
    }

    fetchCompanies();

    return () => {
      isActive = false;
    };
  }, [user, authLoading]);

  const handleSetCompany = (company: Company) => {
    setCompanies(prev => (prev.some(c => c.id === company.id) ? prev : [...prev, company]));
    setCurrentCompany(company);
    localStorage.setItem("fulfillmate_company_id", company.id);
    localStorage.removeItem("distrohub_company_id"); // clean up old key
  };

  return (
    <CompanyContext.Provider value={{ companies, currentCompany, setCurrentCompany: handleSetCompany, loading }}>
      {children}
    </CompanyContext.Provider>
  );
}

