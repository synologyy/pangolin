import AccessToken from "@app/components/AccessToken";

export default async function ResourceAuthPage(props: {
    params: Promise<{ accessToken: string }>;
}) {
    const params = await props.params;

    return (
        <div className="w-full max-w-md mx-auto p-3 md:mt-32">
            <AccessToken token={params.accessToken} />
        </div>
    );
}
