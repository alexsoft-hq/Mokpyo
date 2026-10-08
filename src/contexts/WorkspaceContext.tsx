import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { api, Organization } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';

interface WorkspaceContextType {
  organizations: Organization[];
  currentOrganization: Organization | null;
  setCurrentOrganization: (org: Organization) => void;
  refreshOrganizations: () => Promise<void>;
  createOrganization: (name: string) => Promise<Organization>;
  isLoading: boolean;
  needsWorkspace: boolean;
}

const WorkspaceContext = createContext<WorkspaceContextType | undefined>(undefined);

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const { user, token } = useAuth();
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [currentOrganization, setCurrentOrgState] = useState<Organization | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [needsWorkspace, setNeedsWorkspace] = useState(false);

  const refreshOrganizations = useCallback(async () => {
    try {
      const orgs = await api.getOrganizations();
      setOrganizations(orgs);

      if (orgs.length === 0) {
        setNeedsWorkspace(true);
        setCurrentOrgState(null);
        return;
      }

      setNeedsWorkspace(false);

      // Try to restore last selected org
      const storedOrgId = localStorage.getItem('currentOrganizationId');
      const storedOrg = orgs.find((o) => o.id === storedOrgId);

      if (storedOrg) {
        setCurrentOrgState(storedOrg);
        localStorage.setItem('currentOrganizationId', storedOrg.id);
      } else {
        // Auto-select first org
        setCurrentOrgState(orgs[0]);
        localStorage.setItem('currentOrganizationId', orgs[0].id);
      }
    } catch (error) {
      console.error('Failed to fetch organizations:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (token && user) {
      refreshOrganizations();
    } else {
      setOrganizations([]);
      setCurrentOrgState(null);
      setIsLoading(false);
      setNeedsWorkspace(false);
    }
  }, [token, user, refreshOrganizations]);

  const setCurrentOrganization = useCallback((org: Organization) => {
    setCurrentOrgState(org);
    localStorage.setItem('currentOrganizationId', org.id);
  }, []);

  const createOrganization = useCallback(async (name: string) => {
    const org = await api.createOrganization(name);
    await refreshOrganizations();
    setCurrentOrganization(org);
    return org;
  }, [refreshOrganizations, setCurrentOrganization]);

  return (
    <WorkspaceContext.Provider
      value={{
        organizations,
        currentOrganization,
        setCurrentOrganization,
        refreshOrganizations,
        createOrganization,
        isLoading,
        needsWorkspace,
      }}
    >
      {children}
    </WorkspaceContext.Provider>
  );
}

export function useWorkspace() {
  const context = useContext(WorkspaceContext);
  if (context === undefined) {
    throw new Error('useWorkspace must be used within a WorkspaceProvider');
  }
  return context;
}
