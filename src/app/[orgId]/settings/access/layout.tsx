interface AccessLayoutProps {
    children: React.ReactNode;
    params: Promise<{
        resourceId?: number | string;
        orgId: string;
    }>;
}

export default async function ResourceLayout(props: AccessLayoutProps) {
    const params = await props.params;
    const { children } = props;

    return <>{children}</>;
}
