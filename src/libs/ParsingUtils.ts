import CONST from '@src/CONST';

import type {MarkdownRange} from '@expensify/react-native-live-markdown';

import {parseExpensiMark} from '@expensify/react-native-live-markdown';
import {Str} from 'expensify-common';

import Parser from './Parser';
import {addSMSDomainIfPhoneNumber} from './PhoneNumber';

type Extras = NonNullable<NonNullable<Parameters<typeof Parser.replace>[1]>['extras']>;

/**
 * Handles possible short mentions inside ranges by verifying if the specific range refers to a user mention/login
 * that is available in passed `availableMentions` list. If yes, then it gets the same styling as normal email mention.
 * In addition, applies special styling to current user.
 */
function decorateRangesWithShortMentions(ranges: MarkdownRange[], text: string, availableMentions: string[], currentUserMentions?: string[]): MarkdownRange[] {
    'worklet';

    return ranges
        .map((range) => {
            if (range.type === 'mention-short') {
                // +1 because we want to skip `@` character from the mention value - ex: @mateusz -> mateusz
                const mentionValue = text.slice(range.start + 1, range.start + range.length);

                // A login can never end with a dot, so any trailing dots are sentence punctuation that the parser swallowed
                // into the mention token - ex: @mateusz. -> mateusz. The range has to shrink by the amount of trimmed dots.
                let loginLength = mentionValue.length;
                while (loginLength > 0 && mentionValue[loginLength - 1] === '.') {
                    loginLength--;
                }
                const login = mentionValue.slice(0, loginLength);
                const trimmedRange = {...range, length: range.length - (mentionValue.length - loginLength)};

                if (currentUserMentions?.includes(login)) {
                    return {
                        ...trimmedRange,
                        type: 'mention-here',
                    };
                }

                if (availableMentions.includes(login)) {
                    return {
                        ...trimmedRange,
                        type: 'mention-user',
                    };
                }

                // If it's neither, we remove the range since no styling will be needed
                return;
            }

            // Iterate over full mentions and see if any is a self mention
            if (range.type === 'mention-user') {
                const mentionValue = text.slice(range.start + 1, range.start + range.length);

                if (currentUserMentions?.includes(mentionValue)) {
                    return {
                        ...range,
                        type: 'mention-here',
                    };
                }
            }
            return range;
        })
        .filter((maybeRange): maybeRange is MarkdownRange => !!maybeRange);
}

function parseExpensiMarkWithShortMentions(text: string, availableMentions: string[], currentUserMentions?: string[]) {
    'worklet';

    const parsedRanges = parseExpensiMark(text);
    return decorateRangesWithShortMentions(parsedRanges, text, availableMentions, currentUserMentions);
}

type ShortMentionWithDomain = {
    /** The short mention converted into a full login, with the email or SMS domain added */
    login: string;

    /** Trailing dots that were trimmed off the short mention, as they can never be part of a login */
    trailingDots: string;
};

/**
 * Adds a domain to a short mention, converting it into a full mention with email or SMS domain.
 * A login can never end with a dot, so trailing dots are trimmed before the lookup and returned separately,
 * allowing the caller to re-emit them as the sentence punctuation they are.
 * @returns The converted mention with the trimmed trailing dots, or undefined if conversion is not applicable.
 */
function addDomainToShortMention(mention: string, availableMentionLogins: string[], userPrivateDomain?: string): ShortMentionWithDomain | undefined {
    const trailingDots = mention.match(CONST.REGEX.TRAILING_DOTS)?.[0] ?? '';
    const login = mention.slice(0, mention.length - trailingDots.length);

    if (!Str.isValidEmail(login) && userPrivateDomain) {
        const mentionWithEmailDomain = `${login}@${userPrivateDomain}`;
        if (availableMentionLogins.includes(mentionWithEmailDomain)) {
            return {login: mentionWithEmailDomain, trailingDots};
        }
    }
    if (Str.isValidE164Phone(login)) {
        const mentionWithSmsDomain = addSMSDomainIfPhoneNumber(login);
        if (availableMentionLogins.includes(mentionWithSmsDomain)) {
            return {login: mentionWithSmsDomain, trailingDots};
        }
    }
    return undefined;
}

type GetParsedMessageWithShortMentionsArgs = {
    text: string;
    availableMentionLogins: string[];
    userEmailDomain?: string;
    parserOptions: {
        disabledRules?: string[];
        extras?: Extras;
    };
};

/**
 * This function receives raw text of the message, parses it with ExpensiMark, then transforms short-mentions
 * into full mentions by adding a user domain to them.
 * It returns a message text that can be safely sent to backend, with mentions handled.
 *
 * Detailed info:
 * The backend allows only 2 kinds of mention tags: <mention-here> and <mention-user>.
 * However, ExpensiMark can also produce a special `<mention-short>` tag, which is just the @login part of a full user login.
 * This is handled inside `react-native-live-markdown` with a special function `parseExpensiMark` and then processed with `decorateRangesWithShortMentions`.
 * However, we cannot use `parseExpensiMark` for the text that is being sent to backend, as we need html mention tags.
 * This function is the missing piece that will use ExpensiMark for parsing, but will also strip+transform `mention-short` into full mentions.
 */
function getParsedMessageWithShortMentions({text, availableMentionLogins, userEmailDomain, parserOptions}: GetParsedMessageWithShortMentionsArgs) {
    const parsedText = Parser.replace(text, {
        shouldEscapeText: true,
        disabledRules: parserOptions.disabledRules,
        extras: parserOptions.extras,
    });

    const textWithHandledMentions = parsedText.replaceAll(CONST.REGEX.SHORT_MENTION_HTML, (fullMatch, group1) => {
        // Casting here is safe since our logic guarantees that if regex matches we will get group1 as non-empty string
        const shortMention = group1 as string;
        if (!Str.isValidMention(shortMention)) {
            return shortMention;
        }

        const loginPart = shortMention.substring(1);
        const mentionWithDomain = addDomainToShortMention(loginPart, availableMentionLogins, userEmailDomain);
        return mentionWithDomain ? `<mention-user>@${mentionWithDomain.login}</mention-user>${mentionWithDomain.trailingDots}` : shortMention;
    });

    return textWithHandledMentions;
}

export {parseExpensiMarkWithShortMentions, decorateRangesWithShortMentions, addDomainToShortMention, getParsedMessageWithShortMentions};
