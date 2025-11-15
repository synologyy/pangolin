export function timeAgoFormatter(
    dateInput: string | Date,
    short: boolean = false
): string {
    const date = new Date(dateInput);
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    const secondsInMinute = 60;
    const secondsInHour = 60 * secondsInMinute;
    const secondsInDay = 24 * secondsInHour;
    const secondsInWeek = 7 * secondsInDay;
    const secondsInMonth = 30 * secondsInDay;
    const secondsInYear = 365 * secondsInDay;

    let value: number;
    let unit: Intl.RelativeTimeFormatUnit;

    if (diffInSeconds < secondsInMinute) {
        value = diffInSeconds;
        unit = "second";
    } else if (diffInSeconds < secondsInHour) {
        value = Math.floor(diffInSeconds / secondsInMinute);
        unit = "minute";
    } else if (diffInSeconds < secondsInDay) {
        value = Math.floor(diffInSeconds / secondsInHour);
        unit = "hour";
    } else if (diffInSeconds < secondsInWeek) {
        value = Math.floor(diffInSeconds / secondsInDay);
        unit = "day";
    } else if (diffInSeconds < secondsInMonth) {
        value = Math.floor(diffInSeconds / secondsInWeek);
        unit = "week";
    } else if (diffInSeconds < secondsInYear) {
        value = Math.floor(diffInSeconds / secondsInMonth);
        unit = "month";
    } else {
        value = Math.floor(diffInSeconds / secondsInYear);
        unit = "year";
    }

    const rtf = new Intl.RelativeTimeFormat(navigator.languages[0] ?? "en", {
        numeric: "auto",
        style: short ? "narrow" : "long"
    });
    return rtf.format(-value, unit);
}
