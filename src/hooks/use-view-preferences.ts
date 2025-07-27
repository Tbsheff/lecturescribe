import { create } from 'zustand';
import { persist } from 'zustand/middleware';

type ViewMode = 'grid' | 'list' | 'timeline';
type DateGroup = 'today' | 'thisWeek' | 'thisMonth' | 'older';

interface ViewPreferencesState {
  viewMode: ViewMode;
  dateFilter: DateGroup | 'all';
  showFolderSidebar: boolean;
  expandedGroups: Record<DateGroup, boolean>;
  expandedFolders: Record<string, boolean>;
  setViewMode: (mode: ViewMode) => void;
  setDateFilter: (filter: DateGroup | 'all') => void;
  setShowFolderSidebar: (show: boolean) => void;
  setExpandedGroup: (group: DateGroup, expanded: boolean) => void;
  setExpandedFolder: (folderId: string, expanded: boolean) => void;
  toggleFolderExpansion: (folderId: string) => void;
}

export const useViewPreferences = create<ViewPreferencesState>()(
  persist(
    (set) => ({
      viewMode: 'grid',
      dateFilter: 'all',
      showFolderSidebar: true,
      expandedGroups: {
        today: true,
        thisWeek: true,
        thisMonth: true,
        older: false,
      },
      expandedFolders: {},
      setViewMode: (mode) => set({ viewMode: mode }),
      setDateFilter: (filter) => set({ dateFilter: filter }),
      setShowFolderSidebar: (show) => set({ showFolderSidebar: show }),
      setExpandedGroup: (group, expanded) =>
        set((state) => ({
          expandedGroups: { ...state.expandedGroups, [group]: expanded },
        })),
      setExpandedFolder: (folderId, expanded) =>
        set((state) => ({
          expandedFolders: { ...state.expandedFolders, [folderId]: expanded },
        })),
      toggleFolderExpansion: (folderId) =>
        set((state) => ({
          expandedFolders: {
            ...state.expandedFolders,
            [folderId]: !state.expandedFolders[folderId],
          },
        })),
    }),
    {
      name: 'view-preferences',
    }
  )
);