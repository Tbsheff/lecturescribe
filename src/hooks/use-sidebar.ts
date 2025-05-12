import { create } from 'zustand';

type SidebarSettings = { disabled: boolean; isHoverOpen: boolean };
type SidebarStore = {
  isOpen: boolean;
  isHover: boolean;
  settings: SidebarSettings;
  toggleOpen: () => void;
  setIsOpen: (isOpen: boolean) => void;
  setIsHover: (isHover: boolean) => void;
  getOpenState: () => boolean;
  setSettings: (settings: Partial<SidebarSettings>) => void;
};

export const useSidebar = create<SidebarStore>((set, get) => ({
  isOpen: false,
  isHover: false,
  settings: { disabled: false, isHoverOpen: false },
  toggleOpen: () => set({ isOpen: !get().isOpen }),
  setIsOpen: (isOpen: boolean) => set({ isOpen }),
  setIsHover: (isHover: boolean) => set({ isHover }),
  getOpenState: () => get().isOpen || (get().settings.isHoverOpen && get().isHover),
  setSettings: (settings) => set(state => ({ settings: { ...state.settings, ...settings } })),
}));
