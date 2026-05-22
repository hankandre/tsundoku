export type SettingsSection = {
  href: string;
  label: string;
  comingSoon?: boolean;
};

export type SettingsGroup = {
  label: string;
  sections: SettingsSection[];
};

export const settingsGroups: SettingsGroup[] = [
  {
    label: "Access",
    sections: [{ href: "/admin/settings/users", label: "Users" }],
  },
  {
    label: "Activity",
    sections: [{ href: "/admin/settings/audit-log", label: "Audit log" }],
  },
  {
    label: "Server",
    sections: [{ href: "/admin/settings/authentication", label: "Authentication" }],
  },
  {
    label: "Metadata",
    sections: [
      { href: "/admin/settings/metadata/providers", label: "Providers", comingSoon: true },
      {
        href: "/admin/settings/metadata/match-weights",
        label: "Match weights",
        comingSoon: true,
      },
      { href: "/admin/settings/metadata/persistence", label: "Persistence", comingSoon: true },
      {
        href: "/admin/settings/metadata/public-reviews",
        label: "Public reviews",
        comingSoon: true,
      },
    ],
  },
  {
    label: "Integrations",
    sections: [
      { href: "/admin/settings/email/providers", label: "Email providers", comingSoon: true },
      { href: "/admin/settings/custom-fonts", label: "Custom fonts", comingSoon: true },
      { href: "/admin/settings/opds", label: "OPDS", comingSoon: true },
      { href: "/admin/settings/file-naming", label: "File naming", comingSoon: true },
    ],
  },
];

export function findSection(pathname: string): SettingsSection | null {
  for (const g of settingsGroups) {
    for (const s of g.sections) {
      if (pathname === s.href || pathname.startsWith(s.href + "/")) return s;
    }
  }
  return null;
}
