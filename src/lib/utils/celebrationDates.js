const MS_PER_DAY = 24 * 60 * 60 * 1000;

function parseDateParts(value) {
    if (!value) return null;

    const dateOnlyMatch = String(value).match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (dateOnlyMatch) {
        return {
            year: Number(dateOnlyMatch[1]),
            month: Number(dateOnlyMatch[2]),
            day: Number(dateOnlyMatch[3])
        };
    }

    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return null;

    return {
        year: parsed.getFullYear(),
        month: parsed.getMonth() + 1,
        day: parsed.getDate()
    };
}

function getSafeDate(year, month, day) {
    const maxDay = new Date(year, month, 0).getDate();
    const safeDay = Math.min(day, maxDay);
    const date = new Date(year, month - 1, safeDay);
    date.setHours(0, 0, 0, 0);
    return date;
}

function toOrdinal(value) {
    const mod100 = value % 100;
    if (mod100 >= 11 && mod100 <= 13) return `${value}th`;

    const mod10 = value % 10;
    if (mod10 === 1) return `${value}st`;
    if (mod10 === 2) return `${value}nd`;
    if (mod10 === 3) return `${value}rd`;
    return `${value}th`;
}

function formatMonthDay(date) {
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function formatSlashDate({ year, month, day }) {
    return `${String(month).padStart(2, '0')}/${String(day).padStart(2, '0')}/${year}`;
}

export function getCelebrationPseudoDate(category, celebrationDate, nowInput = new Date()) {
    const normalizedCategory = (category || '').toLowerCase();
    if (normalizedCategory !== 'birthday' && normalizedCategory !== 'anniversary') {
        return null;
    }

    const parts = parseDateParts(celebrationDate);
    if (!parts) return null;

    const now = new Date(nowInput);
    now.setHours(0, 0, 0, 0);

    let nextOccurrence = getSafeDate(now.getFullYear(), parts.month, parts.day);
    if (nextOccurrence < now) {
        nextOccurrence = getSafeDate(now.getFullYear() + 1, parts.month, parts.day);
    }

    const daysUntil = Math.round((nextOccurrence.getTime() - now.getTime()) / MS_PER_DAY);
    const isToday = daysUntil === 0;
    const dayUnit = daysUntil === 1 ? 'day' : 'days';

    if (normalizedCategory === 'birthday') {
        return {
            primary: isToday ? 'Birthday is today!' : `Birthday countdown: ${daysUntil} ${dayUnit}`,
            secondary: `On ${formatMonthDay(nextOccurrence)}`
        };
    }

    const anniversaryYear = Math.max(1, nextOccurrence.getFullYear() - parts.year);
    const anniversaryLabel = `${toOrdinal(anniversaryYear)} year anniversary`;

    return {
        primary: isToday ? `${anniversaryLabel} is today!` : `${anniversaryLabel} in ${daysUntil} ${dayUnit}`,
        secondary: `Since ${formatSlashDate(parts)}`
    };
}
