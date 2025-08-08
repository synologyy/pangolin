import { redirect } from "next/navigation";

export default async function UserPage(props: {
    params: Promise<{ userId: string }>;
}) {
    const { userId } = await props.params;
    redirect(`/admin/users/${userId}/general`);
} 