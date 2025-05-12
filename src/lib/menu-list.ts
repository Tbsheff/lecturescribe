import {
  Home,
  Rocket,
  Settings,
  Headphones,
  ArrowRight,
  Folder,
  Edit,
  LucideIcon
} from "lucide-react";

type Submenu = {
  href: string;
  label: string;
  active?: boolean;
};

type Menu = {
  href: string;
  label: string;
  active?: boolean;
  icon: LucideIcon;
  submenus?: Submenu[];
};

type Group = {
  groupLabel: string;
  menus: Menu[];
};

export function getMenuList(pathname: string): Group[] {
  return [
    {
      groupLabel: "",
      menus: [
        {
          href: "/",
          label: "Home",
          icon: Home,
          submenus: []
        }
      ]
    },
    {
      groupLabel: "Features",
      menus: [
        {
          href: "/folders",
          label: "Folders",
          icon: Folder
        },
        {
          href: "/audio-summary",
          label: "Audio Upload",
          icon: Headphones
        },
        {
          href: "/editor",
          label: "Enhanced Editor",
          icon: Edit
        },
        {
          href: "/how-to-use",
          label: "How to use",
          icon: Rocket
        }
      ]
    },
    {
      groupLabel: "Settings",
      menus: [
        {
          href: "/settings",
          label: "Settings",
          icon: Settings
        },
        {
          href: "/migrate",
          label: "Migrate Notes",
          icon: ArrowRight
        }
      ]
    }
  ];
}
