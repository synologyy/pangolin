"use client";

import {
    SettingsContainer,
    SettingsSection,
    SettingsSectionTitle as SectionTitle,
    SettingsSectionBody,
    SettingsSectionFooter
} from "@app/components/Settings";
import SettingsSectionTitle from "@app/components/SettingsSectionTitle";
import { Alert } from "@app/components/ui/alert";
import { Button } from "@app/components/ui/button";
import {
    Shield,
    Zap,
    RefreshCw,
    Activity,
    Wrench,
    CheckCircle,
    ExternalLink
} from "lucide-react";
import Link from "next/link";

export default async function ManagedPage() {
    return (
        <>
            <SettingsSectionTitle
                title="Managed Self-Hosted"
                description="More reliable and low-maintenance self-hosted Pangolin server with extra bells and whistles"
            />

            <SettingsContainer>
                <SettingsSection>
                    <SettingsSectionBody>
                        <p className="text-muted-foreground mb-4">
                            <strong>Managed Self-Hosted Pangolin</strong> is a
                            deployment option designed for people who want
                            simplicity and extra reliability while still keeping
                            their data private and self-hosted.
                        </p>
                        <p className="text-muted-foreground mb-6">
                            With this option, you still run your own Pangolin
                            node — your tunnels, SSL termination, and traffic
                            all stay on your server. The difference is that
                            management and monitoring are handled through our
                            cloud dashboard, which unlocks a number of benefits:
                        </p>

                        <div className="grid gap-4 md:grid-cols-2 py-4">
                            <div className="space-y-3">
                                <div className="flex items-start gap-3">
                                    <CheckCircle className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" />
                                    <div>
                                        <h4 className="font-medium">
                                            Simpler operations
                                        </h4>
                                        <p className="text-sm text-muted-foreground">
                                            No need to run your own mail server
                                            or set up complex alerting. You'll
                                            get health checks and downtime
                                            alerts out of the box.
                                        </p>
                                    </div>
                                </div>

                                <div className="flex items-start gap-3">
                                    <RefreshCw className="w-5 h-5 text-blue-500 mt-0.5 flex-shrink-0" />
                                    <div>
                                        <h4 className="font-medium">
                                            Automatic updates
                                        </h4>
                                        <p className="text-sm text-muted-foreground">
                                            The cloud dashboard evolves quickly,
                                            so you get new features and bug
                                            fixes without having to manually
                                            pull new containers every time.
                                        </p>
                                    </div>
                                </div>

                                <div className="flex items-start gap-3">
                                    <Wrench className="w-5 h-5 text-orange-500 mt-0.5 flex-shrink-0" />
                                    <div>
                                        <h4 className="font-medium">
                                            Less maintenance
                                        </h4>
                                        <p className="text-sm text-muted-foreground">
                                            No database migrations, backups, or
                                            extra infrastructure to manage. We
                                            handle that in the cloud.
                                        </p>
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-3">
                                <div className="flex items-start gap-3">
                                    <Activity className="w-5 h-5 text-purple-500 mt-0.5 flex-shrink-0" />
                                    <div>
                                        <h4 className="font-medium">
                                            Cloud failover
                                        </h4>
                                        <p className="text-sm text-muted-foreground">
                                            If your node goes down, your tunnels
                                            can temporarily fail over to our
                                            cloud points of presence until you
                                            bring it back online.
                                        </p>
                                    </div>
                                </div>
                                <div className="flex items-start gap-3">
                                    <Shield className="w-5 h-5 text-indigo-500 mt-0.5 flex-shrink-0" />
                                    <div>
                                        <h4 className="font-medium">
                                            High availability (PoPs)
                                        </h4>
                                        <p className="text-sm text-muted-foreground">
                                            You can also attach multiple nodes
                                            to your account for redundancy and
                                            better performance.
                                        </p>
                                    </div>
                                </div>

                                <div className="flex items-start gap-3">
                                    <Zap className="w-5 h-5 text-yellow-500 mt-0.5 flex-shrink-0" />
                                    <div>
                                        <h4 className="font-medium">
                                            Future enhancements
                                        </h4>
                                        <p className="text-sm text-muted-foreground">
                                            We're planning to add more
                                            analytics, alerting, and management
                                            tools to make your deployment even
                                            more robust.
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <Alert
                            variant="neutral"
                            className="flex items-center gap-1"
                        >
                            Read the docs to learn more about the Managed
                            Self-Hosted option in our{" "}
                            <Link
                                href="https://docs.digpangolin.com/self-host/advanced/convert-to-managed"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="hover:underline text-primary flex items-center gap-1"
                            >
                                documentation
                                <ExternalLink className="w-4 h-4" />
                            </Link>
                            .
                        </Alert>
                    </SettingsSectionBody>
                    <SettingsSectionFooter>
                        <Link
                            href="https://docs.digpangolin.com/self-host/advanced/convert-to-managed"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="hover:underline text-primary flex items-center gap-1"
                        >
                            <Button>
                                Convert This Node to Managed Self-Hosted
                            </Button>
                        </Link>
                    </SettingsSectionFooter>
                </SettingsSection>
            </SettingsContainer>
        </>
    );
}
