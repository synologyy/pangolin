import { SidebarNavItem } from "@app/components/SidebarNav";
import { build } from "@server/build";
import {
    Settings,
    Users,
    Link as LinkIcon,
    Waypoints,
    Combine,
    Fingerprint,
    KeyRound,
    TicketCheck,
    User,
    Globe, // Added from 'dev' branch
    MonitorUp, // Added from 'dev' branch
    Server,
    ReceiptText,
    CreditCard,
    Logs,
    SquareMousePointer,
    ScanEye,
    GlobeLock
} from "lucide-react";

export type SidebarNavSection = {
    // Added from 'dev' branch
    heading: string;
    items: SidebarNavItem[];
};

// Merged from 'user-management-and-resources' branch
export const orgLangingNavItems: SidebarNavItem[] = [
    {
        title: "sidebarAccount",
        href: "/{orgId}",
        icon: <User className="size-4 flex-none" />
    }
];

export const orgNavSections = (
    enableClients: boolean = true
): SidebarNavSection[] => [
    {
        heading: "General",
        items: [
            {
                title: "sidebarSites",
                href: "/{orgId}/settings/sites",
                icon: <Combine className="size-4 flex-none" />
            },
            {
                title: "sidebarResources",
                icon: <Waypoints className="size-4 flex-none" />,
                items: [
                    {
                        title: "sidebarProxyResources",
                        href: "/{orgId}/settings/resources/proxy",
                        icon: <Globe className="size-4 flex-none" />
                    },
                    ...(enableClients
                        ? [
                              {
                                  title: "sidebarClientResources",
                                  href: "/{orgId}/settings/resources/client",
                                  icon: (
                                      <GlobeLock className="size-4 flex-none" />
                                  )
                              }
                          ]
                        : [])
                ]
            },
            ...(enableClients
                ? [
                      {
                          title: "sidebarClients",
                          href: "/{orgId}/settings/clients",
                          icon: <MonitorUp className="size-4 flex-none" />,
                          isBeta: true
                      }
                  ]
                : []),
            ...(build == "saas"
                ? [
                      {
                          title: "sidebarRemoteExitNodes",
                          href: "/{orgId}/settings/remote-exit-nodes",
                          icon: <Server className="size-4 flex-none" />,
                          showEE: true
                      }
                  ]
                : []),
            {
                title: "sidebarDomains",
                href: "/{orgId}/settings/domains",
                icon: <Globe className="size-4 flex-none" />
            },
            {
                title: "sidebarBluePrints",
                href: "/{orgId}/settings/blueprints",
                icon: <ReceiptText className="size-4 flex-none" />
            }
        ]
    },
    {
        heading: "Access Control",
        items: [
            {
                title: "sidebarUsers",
                icon: <User className="size-4 flex-none" />,
                items: [
                    {
                        title: "sidebarUsers",
                        href: "/{orgId}/settings/access/users",
                        icon: <User className="size-4 flex-none" />
                    },
                    {
                        title: "sidebarInvitations",
                        href: "/{orgId}/settings/access/invitations",
                        icon: <TicketCheck className="size-4 flex-none" />
                    }
                ]
            },
            {
                title: "sidebarRoles",
                href: "/{orgId}/settings/access/roles",
                icon: <Users className="size-4 flex-none" />
            },
            ...(build == "saas"
                ? [
                      {
                          title: "sidebarIdentityProviders",
                          href: "/{orgId}/settings/idp",
                          icon: <Fingerprint className="size-4 flex-none" />,
                          showEE: true
                      }
                  ]
                : []),
            {
                title: "sidebarShareableLinks",
                href: "/{orgId}/settings/share-links",
                icon: <LinkIcon className="size-4 flex-none" />
            }
        ]
    },
    {
        heading: "Analytics",
        items: (() => {
            const logItems: SidebarNavItem[] = [
                {
                    title: "sidebarLogsRequest",
                    href: "/{orgId}/settings/logs/request",
                    icon: <SquareMousePointer className="size-4 flex-none" />
                },
                ...(build != "oss"
                    ? [
                          {
                              title: "sidebarLogsAccess",
                              href: "/{orgId}/settings/logs/access",
                              icon: <ScanEye className="size-4 flex-none" />
                          },
                          {
                              title: "sidebarLogsAction",
                              href: "/{orgId}/settings/logs/action",
                              icon: <Logs className="size-4 flex-none" />
                          }
                      ]
                    : [])
            ];

            // If only one log item, return it directly without grouping
            if (logItems.length === 1) {
                return logItems;
            }

            // If multiple log items, create a group
            return [
                {
                    title: "sidebarLogs",
                    icon: <Logs className="size-4 flex-none" />,
                    items: logItems
                }
            ];
        })()
    },
    {
        heading: "Organization",
        items: [
            {
                title: "sidebarApiKeys",
                href: "/{orgId}/settings/api-keys",
                icon: <KeyRound className="size-4 flex-none" />
            },
            ...(build == "saas"
                ? [
                      {
                          title: "sidebarBilling",
                          href: "/{orgId}/settings/billing",
                          icon: <CreditCard className="size-4 flex-none" />
                      }
                  ]
                : []),
            ...(build == "saas"
                ? [
                      {
                          title: "sidebarEnterpriseLicenses",
                          href: "/{orgId}/settings/license",
                          icon: <TicketCheck className="size-4 flex-none" />
                      }
                  ]
                : []),
            {
                title: "sidebarSettings",
                href: "/{orgId}/settings/general",
                icon: <Settings className="size-4 flex-none" />
            }
        ]
    }
];

export const adminNavSections: SidebarNavSection[] = [
    {
        heading: "Admin",
        items: [
            {
                title: "sidebarAllUsers",
                href: "/admin/users",
                icon: <Users className="size-4 flex-none" />
            },
            {
                title: "sidebarApiKeys",
                href: "/admin/api-keys",
                icon: <KeyRound className="size-4 flex-none" />
            },
            {
                title: "sidebarIdentityProviders",
                href: "/admin/idp",
                icon: <Fingerprint className="size-4 flex-none" />
            },
            ...(build == "enterprise"
                ? [
                      {
                          title: "sidebarLicense",
                          href: "/admin/license",
                          icon: <TicketCheck className="size-4 flex-none" />
                      }
                  ]
                : [])
        ]
    }
];
