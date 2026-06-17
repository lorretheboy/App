import {isValid, parse} from 'date-fns';
import {fromZonedTime} from 'date-fns-tz';
import DateUtils from '@libs/DateUtils';
import CONST from '@src/CONST';
import type {SelectedTimezone} from '@src/types/onyx/PersonalDetails';

const AS_OF_LABEL_PATTERN = /^As of:\s*(.+)$/i;
const CHART_DISPLAY_FORMAT = `MMM d, yyyy 'at' ${CONST.DATE.LOCAL_TIME_FORMAT}`;

/** Matches the year-less server "As of" datetime (`MMM d, h:mm aa`) with and without a leading zero on the hour. */
const SERVER_AS_OF_PARSE_FORMATS = ['MMM d, hh:mm aa', 'MMM d, h:mm aa'] as const;

/** Maps the timezone abbreviation the server appends to the label to an IANA timezone used to anchor the instant. */
const TIMEZONE_ABBREVIATION_TO_IANA: Record<string, string> = {
    PT: 'America/Los_Angeles',
    PST: 'America/Los_Angeles',
    PDT: 'America/Los_Angeles',
    MT: 'America/Denver',
    MST: 'America/Denver',
    MDT: 'America/Denver',
    CT: 'America/Chicago',
    CST: 'America/Chicago',
    CDT: 'America/Chicago',
    ET: 'America/New_York',
    EST: 'America/New_York',
    EDT: 'America/New_York',
};

const TRAILING_TIMEZONE_PATTERN = /\s([A-Z]{2,4})$/;

/**
 * Parses a Victory chart "As of" datetime label text into a UTC date.
 *
 * The server emits a year-less, human-formatted string with a trailing timezone abbreviation (e.g. `May 6, 12:49 PM PT`).
 * The year defaults to the current year and the captured zone abbreviation anchors the absolute instant.
 */
function parseDateAsUTC(sourceText: string): Date | null {
    const trimmedText = sourceText.trim();

    const timezoneMatch = trimmedText.match(TRAILING_TIMEZONE_PATTERN);
    const timeZone = timezoneMatch ? TIMEZONE_ABBREVIATION_TO_IANA[timezoneMatch[1]] : undefined;
    const normalizedText = (timeZone ? trimmedText.slice(0, timezoneMatch?.index) : trimmedText).trim();

    for (const formatStr of SERVER_AS_OF_PARSE_FORMATS) {
        const parsed = parse(normalizedText, formatStr, new Date());

        if (!isValid(parsed)) {
            continue;
        }

        return fromZonedTime(parsed, timeZone ?? 'UTC');
    }

    return null;
}

/**
 * Rewrites a `<victorylabel>` "As of: ..." string in the viewer's timezone.
 * Returns the original text when the label does not match or cannot be parsed.
 */
function getLocalizedVictoryChartLabelText(text: string, timezone?: SelectedTimezone): string {
    if (!timezone) {
        return text;
    }

    const match = text.trim().match(AS_OF_LABEL_PATTERN);
    if (!match) {
        return text;
    }

    const utcDate = parseDateAsUTC(match[1]);
    if (!utcDate) {
        return text;
    }

    const localizedDate = DateUtils.formatInTimeZoneWithFallback(utcDate, timezone, CHART_DISPLAY_FORMAT);
    return `As of: ${localizedDate}`;
}

export {getLocalizedVictoryChartLabelText, parseDateAsUTC};
