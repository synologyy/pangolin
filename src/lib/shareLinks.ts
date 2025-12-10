export function constructShareLink(token: string) {
    return `${window.location.origin}/s/${token!}`;
}
