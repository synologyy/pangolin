export function getSevenDaysAgo() {
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Set to midnight
    const sevenDaysAgo = new Date(today);
    sevenDaysAgo.setDate(today.getDate() - 7);
    return sevenDaysAgo;
}
