import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { Project } from "@/types/goal";
import { api } from "@/lib/api";
import { buildProjectTree } from "@/lib/projectTree";
import { useAuth } from "@/contexts/AuthContext";
import { useWorkspace } from "@/contexts/WorkspaceContext";

interface ProjectContextType {
  projects: Project[];
  projectTree: Project[];
  currentProject: Project | null;
  setCurrentProject: (project: Project) => void;
  includeDescendants: boolean;
  setIncludeDescendants: (value: boolean) => void;
  refreshProjects: () => Promise<void>;
  createProject: (project: {
    name: string;
    description?: string;
    parentId?: string | null;
  }) => Promise<void>;
  updateProject: (
    id: string,
    project: { name?: string; description?: string; parentId?: string | null },
  ) => Promise<void>;
  deleteProject: (id: string, confirmName: string) => Promise<void>;
  isLoading: boolean;
}

const ProjectContext = createContext<ProjectContextType | undefined>(undefined);

export const useProject = () => {
  const context = useContext(ProjectContext);
  if (!context) {
    throw new Error("useProject must be used within a ProjectProvider");
  }
  return context;
};

interface ProjectProviderProps {
  children: ReactNode;
}

export const ProjectProvider = ({ children }: ProjectProviderProps) => {
  const { token } = useAuth();
  const { currentOrganization } = useWorkspace();
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectTree, setProjectTree] = useState<Project[]>([]);
  const [currentProject, setCurrentProjectState] = useState<Project | null>(null);
  const [includeDescendants, setIncludeDescendantsState] = useState<boolean>(() => {
    const stored = localStorage.getItem("includeDescendants");
    return stored === "true";
  });
  const [isLoading, setIsLoading] = useState(true);

  const refreshProjects = async () => {
    try {
      const fetchedProjects = await api.getProjects();
      setProjects(fetchedProjects);

      // Build tree structure
      const tree = buildProjectTree(fetchedProjects);
      setProjectTree(tree);

      // If no current project is set, or current project no longer exists, set to first project
      const storedProjectId = localStorage.getItem("currentProjectId");
      const storedProject = fetchedProjects.find((p) => p.id === storedProjectId);

      if (storedProject) {
        setCurrentProjectState(storedProject);
      } else if (fetchedProjects.length > 0) {
        setCurrentProjectState(fetchedProjects[0]);
        localStorage.setItem("currentProjectId", fetchedProjects[0].id);
      } else {
        // No projects exist - set loading to false anyway
        setCurrentProjectState(null);
      }
    } catch (error) {
      console.error("Failed to fetch projects:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (token && currentOrganization) {
      refreshProjects();
    } else {
      setProjects([]);
      setProjectTree([]);
      setCurrentProjectState(null);
      setIsLoading(false);
    }
  }, [token, currentOrganization?.id]);

  const setCurrentProject = (project: Project) => {
    setCurrentProjectState(project);
    localStorage.setItem("currentProjectId", project.id);
  };

  const setIncludeDescendants = (value: boolean) => {
    setIncludeDescendantsState(value);
    localStorage.setItem("includeDescendants", value.toString());
  };

  const createProject = async (project: {
    name: string;
    description?: string;
    parentId?: string | null;
  }) => {
    const newProject = await api.createProject(project);
    await refreshProjects();
    setCurrentProject(newProject);
  };

  const updateProject = async (
    id: string,
    project: { name?: string; description?: string; parentId?: string | null },
  ) => {
    await api.updateProject(id, project);
    await refreshProjects();
  };

  const deleteProject = async (id: string, confirmName: string) => {
    await api.deleteProject(id, confirmName);

    // If deleting current project, switch to first available project
    if (currentProject?.id === id) {
      const remaining = projects.filter((p) => p.id !== id);
      if (remaining.length > 0) {
        setCurrentProject(remaining[0]);
      }
    }

    await refreshProjects();
  };

  return (
    <ProjectContext.Provider
      value={{
        projects,
        projectTree,
        currentProject,
        setCurrentProject,
        includeDescendants,
        setIncludeDescendants,
        refreshProjects,
        createProject,
        updateProject,
        deleteProject,
        isLoading,
      }}
    >
      {children}
    </ProjectContext.Provider>
  );
};
