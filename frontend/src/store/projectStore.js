import { create } from 'zustand';

export const useProjectStore = create((set) => ({
  projects: [],
  activeProject: null,
  
  setProjects: (projects) => set({ projects }),
  setActiveProject: (activeProject) => set({ activeProject }),
  
  clearStore: () => set({ projects: [], activeProject: null }),
}));
