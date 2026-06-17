import {getLocalizedVictoryChartLabelText, parseDateAsUTC} from '@components/HTMLEngineProvider/HTMLRenderers/VictoryChartRenderer/utils/localizeVictoryChartLabelText';

describe('localizeVictoryChartLabelText', () => {
    beforeAll(() => {
        jest.useFakeTimers();
        jest.setSystemTime(new Date('2026-06-17T00:00:00.000Z'));
    });

    afterAll(() => {
        jest.useRealTimers();
    });

    describe('parseDateAsUTC', () => {
        it('parses year-less server chart timestamps anchored by the trailing timezone abbreviation', () => {
            // May 6, 12:49 PM Pacific (PDT, UTC-7) -> 19:49 UTC, year defaulted to the current year
            const utcDate = parseDateAsUTC('May 6, 12:49 PM PT');
            expect(utcDate?.toISOString()).toBe('2026-05-06T19:49:00.000Z');
        });

        it('parses server chart timestamps without a leading zero on the hour', () => {
            const utcDate = parseDateAsUTC('Jun 12, 8:48 AM PT');
            expect(utcDate?.toISOString()).toBe('2026-06-12T15:48:00.000Z');
        });

        it('parses server chart timestamps with a leading zero on the hour', () => {
            expect(parseDateAsUTC('Jun 12, 08:48 AM PT')?.toISOString()).toBe('2026-06-12T15:48:00.000Z');
            expect(parseDateAsUTC('Jun 12, 02:48 PM PT')?.toISOString()).toBe('2026-06-12T21:48:00.000Z');
        });

        it('returns null for invalid timestamps', () => {
            expect(parseDateAsUTC('not a date')).toBeNull();
        });
    });

    describe('getLocalizedVictoryChartLabelText', () => {
        it('rewrites As of labels in the viewer timezone', () => {
            expect(getLocalizedVictoryChartLabelText('As of: May 6, 12:49 PM PT', 'America/Los_Angeles')).toBe('As of: May 6, 2026 at 12:49 PM');
            expect(getLocalizedVictoryChartLabelText('As of: May 6, 12:49 PM PT', 'Asia/Tokyo')).toBe('As of: May 7, 2026 at 4:49 AM');
            expect(getLocalizedVictoryChartLabelText('As of: Jun 12, 8:48 AM PT', 'America/Edmonton')).toBe('As of: Jun 12, 2026 at 9:48 AM');
            expect(getLocalizedVictoryChartLabelText('As of: Jun 12, 8:48 AM PT', 'Asia/Tokyo')).toBe('As of: Jun 13, 2026 at 12:48 AM');
        });

        it('leaves non-As-of labels unchanged', () => {
            expect(getLocalizedVictoryChartLabelText('Top employees by spend', 'America/Los_Angeles')).toBe('Top employees by spend');
        });

        it('returns the original text when no timezone is provided', () => {
            expect(getLocalizedVictoryChartLabelText('As of: May 6, 12:49 PM PT')).toBe('As of: May 6, 12:49 PM PT');
        });

        it('returns the original text when the timestamp cannot be parsed', () => {
            expect(getLocalizedVictoryChartLabelText('As of: not a date', 'America/Los_Angeles')).toBe('As of: not a date');
        });
    });
});
