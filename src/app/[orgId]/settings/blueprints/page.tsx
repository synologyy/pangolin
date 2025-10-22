




type BluePrintsPageProps = {
    params: Promise<{ orgId: string }>;
    searchParams: Promise<{ view?: string }>;
};

export default async function BluePrintsPage(props: BluePrintsPageProps) {
    const params = await props.params;
    return <></>
}