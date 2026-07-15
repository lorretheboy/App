import useConfirmModal from '@hooks/useConfirmModal';
import useCurrentUserPersonalDetails from '@hooks/useCurrentUserPersonalDetails';
import {useMemoizedLazyExpensifyIcons} from '@hooks/useLazyAsset';
import useLocalize from '@hooks/useLocalize';
import useNetwork from '@hooks/useNetwork';
import useOnyx from '@hooks/useOnyx';
import useResponsiveLayout from '@hooks/useResponsiveLayout';
import useTheme from '@hooks/useTheme';
import useThemeStyles from '@hooks/useThemeStyles';
import useWindowDimensions from '@hooks/useWindowDimensions';

import {clearDelegatorErrors, connect, disconnect} from '@libs/actions/Delegate';
import {close} from '@libs/actions/Modal';
import {getLatestError} from '@libs/ErrorUtils';
import {getGpsPoints, stopGpsTrip} from '@libs/GPSDraftDetailsUtils';
import {getPersonalDetailByEmail} from '@libs/PersonalDetailsUtils';

import TextWithEmojiFragment from '@pages/inbox/report/comment/TextWithEmojiFragment';

import variables from '@styles/variables';

import CONST from '@src/CONST';
import ONYXKEYS from '@src/ONYXKEYS';
import {isTrackingSelector} from '@src/selectors/GPSDraftDetails';
import type {PersonalDetails} from '@src/types/onyx';
import type {Errors} from '@src/types/onyx/OnyxCommon';

import {accountIDSelector} from '@selectors/Session';
import {Str} from 'expensify-common';
import React, {useState} from 'react';
import {View} from 'react-native';

import type {RadioItemProps} from './PopoverMenu/v2/rows';

import Avatar from './Avatar';
import CopilotSearchInput from './CopilotSearchInput';
import Icon from './Icon';
import {ModalActions} from './Modal/Global/ModalContext';
import * as PopoverMenu from './PopoverMenu/v2';
import {PressableWithFeedback} from './Pressable';
import {usePressResponderProps} from './Pressable/PressResponder';
import {useProductTrainingContext} from './ProductTrainingContext';
import Text from './Text';
import Tooltip from './Tooltip';
import EducationalTooltip from './Tooltip/EducationalTooltip';

type AccountSwitcherProps = {
    /* Whether the screen is focused. Used to hide the product training tooltip */
    isScreenFocused: boolean;
};

type AccountRow = {
    /** Login of the account this row switches to. Used as the row key and matched against the search value */
    login: string;

    /** Whether this row is the signed-in account, which stays pinned while searching */
    isCurrentUser: boolean;

    /** Props forwarded to the popover's radio row */
    itemProps: RadioItemProps;
};

type AccountSwitcherTooltipProps = {
    /** Whether any account can be switched into */
    canSwitchAccounts: boolean;

    /** Whether the product training tooltip should replace the regular tooltip */
    shouldShowProductTrainingTooltip: boolean;

    /** Renders the product training tooltip content */
    renderProductTrainingTooltip: () => React.ReactNode;

    /** Dismisses the product training tooltip */
    hideProductTrainingTooltip: () => void;

    /** The switcher button the tooltip is anchored to */
    children: React.ReactElement;
};

/** Must render inside `<PopoverMenu.Trigger>` so the product training tooltip can open the same menu the button does. */
function AccountSwitcherTooltip({canSwitchAccounts, shouldShowProductTrainingTooltip, renderProductTrainingTooltip, hideProductTrainingTooltip, children}: AccountSwitcherTooltipProps) {
    const styles = useThemeStyles();
    const {translate} = useLocalize();
    const {onPress: openSwitcher} = usePressResponderProps({});

    if (!shouldShowProductTrainingTooltip) {
        return (
            <Tooltip
                text={translate('delegate.copilotAccess')}
                shiftVertical={8}
                shiftHorizontal={8}
                anchorAlignment={{horizontal: CONST.MODAL.ANCHOR_ORIGIN_HORIZONTAL.LEFT, vertical: CONST.MODAL.ANCHOR_ORIGIN_VERTICAL.BOTTOM}}
                shouldRender={canSwitchAccounts}
            >
                {children}
            </Tooltip>
        );
    }

    return (
        <EducationalTooltip
            shouldRender
            renderTooltipContent={renderProductTrainingTooltip}
            anchorAlignment={{horizontal: CONST.MODAL.ANCHOR_ORIGIN_HORIZONTAL.LEFT, vertical: CONST.MODAL.ANCHOR_ORIGIN_VERTICAL.TOP}}
            shiftVertical={variables.accountSwitcherTooltipShiftVertical}
            shiftHorizontal={variables.accountSwitcherTooltipShiftHorizontal}
            wrapperStyle={styles.productTrainingTooltipWrapper}
            onTooltipPress={() => {
                hideProductTrainingTooltip();
                openSwitcher?.();
            }}
        >
            {children}
        </EducationalTooltip>
    );
}

function AccountSwitcher({isScreenFocused}: AccountSwitcherProps) {
    const icons = useMemoizedLazyExpensifyIcons(['CaretUpDown', 'Checkmark']);
    const currentUserPersonalDetails = useCurrentUserPersonalDetails();
    const styles = useThemeStyles();
    const theme = useTheme();
    const {localeCompare, translate, formatPhoneNumber} = useLocalize();
    const {isOffline} = useNetwork();
    const {shouldUseNarrowLayout} = useResponsiveLayout();
    const [account] = useOnyx(ONYXKEYS.ACCOUNT);
    const [accountID] = useOnyx(ONYXKEYS.SESSION, {selector: accountIDSelector});
    const [isDebugModeEnabled] = useOnyx(ONYXKEYS.IS_DEBUG_MODE_ENABLED);
    const [credentials] = useOnyx(ONYXKEYS.CREDENTIALS);
    const [stashedCredentials = CONST.EMPTY_OBJECT] = useOnyx(ONYXKEYS.STASHED_CREDENTIALS);
    const [isTrackingGPS = false] = useOnyx(ONYXKEYS.GPS_DRAFT_DETAILS, {selector: isTrackingSelector});
    const [session] = useOnyx(ONYXKEYS.SESSION);
    const [stashedSession] = useOnyx(ONYXKEYS.STASHED_SESSION);
    const [activePolicyID] = useOnyx(ONYXKEYS.NVP_ACTIVE_POLICY_ID);
    const [gpsDraftDetails] = useOnyx(ONYXKEYS.GPS_DRAFT_DETAILS);

    const {windowHeight} = useWindowDimensions();

    const [searchValue, setSearchValue] = useState('');
    const delegators = account?.delegatedAccess?.delegators ?? [];

    const isActingAsDelegate = !!account?.delegatedAccess?.delegate;
    const canSwitchAccounts = delegators.length > 0 || isActingAsDelegate;
    const displayName = currentUserPersonalDetails?.displayName ?? '';
    const doesDisplayNameContainEmojis = new RegExp(CONST.REGEX.EMOJIS, CONST.REGEX.EMOJIS.flags.concat('g')).test(displayName);

    const {shouldShowProductTrainingTooltip, renderProductTrainingTooltip, hideProductTrainingTooltip} = useProductTrainingContext(
        CONST.PRODUCT_TRAINING_TOOLTIP_NAMES.ACCOUNT_SWITCHER,
        isScreenFocused && canSwitchAccounts,
    );

    const {showConfirmModal} = useConfirmModal();

    const showOfflineModal = () => {
        showConfirmModal({
            title: translate('common.youAppearToBeOffline'),
            prompt: translate('common.offlinePrompt'),
            confirmText: translate('common.buttonConfirm'),
            shouldShowCancelButton: false,
        });
    };

    const showGpsInProgressModal = async (switchAccount: () => ReturnType<typeof connect | typeof disconnect>) => {
        const result = await showConfirmModal({
            title: translate('gps.switchAccountWarningTripInProgress.title'),
            prompt: translate('gps.switchAccountWarningTripInProgress.prompt'),
            confirmText: translate('gps.switchAccountWarningTripInProgress.confirm'),
            cancelText: translate('common.cancel'),
        });

        if (result.action !== ModalActions.CONFIRM) {
            return;
        }

        await stopGpsTrip(false, getGpsPoints(gpsDraftDetails), true);

        switchAccount();
    };

    const createBaseRow = (personalDetails: PersonalDetails | undefined, errors?: Errors, additionalProps: Partial<Omit<RadioItemProps, 'icon' | 'iconType'>> = {}): RadioItemProps => {
        const error = Object.values(errors ?? {}).at(0) ?? '';
        return {
            text: formatPhoneNumber(personalDetails?.displayName ?? personalDetails?.login ?? ''),
            description: Str.removeSMSDomain(personalDetails?.login ?? ''),
            avatarID: personalDetails?.accountID ?? CONST.DEFAULT_NUMBER_ID,
            icon: personalDetails?.avatar ?? '',
            iconType: CONST.ICON_TYPE_AVATAR,
            outerWrapperStyle: shouldUseNarrowLayout ? {} : styles.accountSwitcherPopover,
            shouldIgnoreCompactStyle: true,
            numberOfLinesDescription: 1,
            errorText: error ?? '',
            shouldShowRedDotIndicator: !!error,
            errorTextStyle: styles.mt2,
            ...additionalProps,
        };
    };

    const accountRows = (): AccountRow[] => {
        const currentUserRow: AccountRow = {
            login: currentUserPersonalDetails.login ?? '',
            isCurrentUser: true,
            itemProps: createBaseRow(currentUserPersonalDetails, undefined, {isSelected: true}),
        };

        if (isActingAsDelegate) {
            const delegateEmail = account?.delegatedAccess?.delegate ?? '';

            // Avoid duplicating the current user in the list when switching accounts
            if (delegateEmail === currentUserPersonalDetails.login) {
                return [currentUserRow];
            }

            const delegatePersonalDetails = getPersonalDetailByEmail(delegateEmail);
            const error = getLatestError(account?.delegatedAccess?.errorFields?.disconnect);

            return [
                {
                    login: delegateEmail,
                    isCurrentUser: false,
                    itemProps: createBaseRow(delegatePersonalDetails, error, {
                        onSelect: () => {
                            if (isOffline) {
                                close(showOfflineModal);
                                return;
                            }

                            if (isTrackingGPS) {
                                close(() => showGpsInProgressModal(() => disconnect({stashedCredentials, stashedSession})));
                                return;
                            }

                            disconnect({stashedCredentials, stashedSession});
                        },
                    }),
                },
                currentUserRow,
            ];
        }

        const delegatorRows: AccountRow[] = delegators
            .filter(({email}) => email !== currentUserPersonalDetails.login)
            .map(({email, role}) => {
                const errorFields = account?.delegatedAccess?.errorFields ?? {};
                const error = getLatestError(errorFields?.connect?.[email]);
                const personalDetails = getPersonalDetailByEmail(email);
                return {
                    login: email,
                    isCurrentUser: false,
                    itemProps: createBaseRow(personalDetails, error, {
                        badgeText: translate('delegate.role', {role}),
                        onSelect: () => {
                            if (isOffline) {
                                close(showOfflineModal);
                                return;
                            }
                            if (isTrackingGPS) {
                                close(() => showGpsInProgressModal(() => connect({email, delegatedAccess: account?.delegatedAccess, credentials, session, activePolicyID})));
                                return;
                            }
                            connect({email, delegatedAccess: account?.delegatedAccess, credentials, session, activePolicyID});
                        },
                    }),
                };
            })
            .sort((firstRow, secondRow) => localeCompare(firstRow.itemProps.text.toLowerCase(), secondRow.itemProps.text.toLowerCase()));

        return [currentUserRow, ...delegatorRows];
    };

    const shouldShowSearchInput = !isActingAsDelegate && delegators.length >= CONST.STANDARD_LIST_ITEM_LIMIT;
    const trimmedSearchValue = shouldShowSearchInput ? searchValue.trim().toLowerCase() : '';
    const rows = accountRows();
    // Filtering is just not rendering the non-matching rows; the current user stays pinned so the switcher always shows who is signed in.
    const filteredRows = trimmedSearchValue
        ? rows.filter(({login, isCurrentUser, itemProps}) => isCurrentUser || itemProps.text.toLowerCase().includes(trimmedSearchValue) || login.toLowerCase().includes(trimmedSearchValue))
        : rows;
    const hasNoSearchResults = !!trimmedSearchValue && !filteredRows.some(({isCurrentUser}) => !isCurrentUser);

    const onDelegatorMenuHidden = () => {
        setSearchValue('');
        clearDelegatorErrors({delegatedAccess: account?.delegatedAccess});
    };

    return (
        <PopoverMenu.Root>
            <PopoverMenu.Trigger>
                <AccountSwitcherTooltip
                    canSwitchAccounts={canSwitchAccounts}
                    shouldShowProductTrainingTooltip={shouldShowProductTrainingTooltip}
                    renderProductTrainingTooltip={renderProductTrainingTooltip}
                    hideProductTrainingTooltip={hideProductTrainingTooltip}
                >
                    <PressableWithFeedback
                        accessible
                        accessibilityLabel={`${translate('common.profile')}, ${displayName}, ${Str.removeSMSDomain(currentUserPersonalDetails?.login ?? '')}`}
                        onPress={hideProductTrainingTooltip}
                        interactive={canSwitchAccounts}
                        pressDimmingValue={canSwitchAccounts ? undefined : 1}
                        wrapperStyle={[styles.flexGrow1, styles.flex1, styles.mnw0, styles.justifyContentCenter]}
                        sentryLabel={CONST.SENTRY_LABEL.ACCOUNT_SWITCHER.SHOW_ACCOUNTS}
                    >
                        <View style={[styles.flexRow, styles.gap3, styles.alignItemsCenter]}>
                            <Avatar
                                type={CONST.ICON_TYPE_AVATAR}
                                size={CONST.AVATAR_SIZE.DEFAULT}
                                avatarID={currentUserPersonalDetails?.accountID}
                                source={currentUserPersonalDetails?.avatar}
                                fallbackIcon={currentUserPersonalDetails.fallbackIcon}
                            />
                            <View style={[styles.flex1, styles.flexShrink1, styles.flexBasis0, styles.justifyContentCenter, styles.gap1]}>
                                <View style={[styles.flexRow, styles.gap1]}>
                                    {doesDisplayNameContainEmojis ? (
                                        <Text numberOfLines={1}>
                                            <TextWithEmojiFragment
                                                message={displayName}
                                                style={[styles.textBold, styles.textLarge, styles.flexShrink1, styles.lineHeightXLarge]}
                                            />
                                        </Text>
                                    ) : (
                                        <Text
                                            numberOfLines={1}
                                            style={[styles.textBold, styles.textLarge, styles.flexShrink1, styles.lineHeightXLarge]}
                                        >
                                            {formatPhoneNumber(displayName)}
                                        </Text>
                                    )}
                                    {!!canSwitchAccounts && (
                                        <View style={styles.justifyContentCenter}>
                                            <Icon
                                                fill={theme.icon}
                                                src={icons.CaretUpDown}
                                                height={variables.iconSizeSmall}
                                                width={variables.iconSizeSmall}
                                            />
                                        </View>
                                    )}
                                </View>
                                <Text
                                    numberOfLines={1}
                                    style={[styles.colorMuted, styles.fontSizeLabel]}
                                >
                                    {Str.removeSMSDomain(currentUserPersonalDetails?.login ?? '')}
                                </Text>
                                {!!isDebugModeEnabled && (
                                    <Text
                                        style={[styles.textLabelSupporting, styles.mt1, styles.w100]}
                                        numberOfLines={1}
                                    >
                                        AccountID: {accountID}
                                    </Text>
                                )}
                            </View>
                        </View>
                    </PressableWithFeedback>
                </AccountSwitcherTooltip>
            </PopoverMenu.Trigger>

            {!!canSwitchAccounts && (
                <PopoverMenu.ScrollableContent
                    anchorAlignment={{
                        horizontal: CONST.MODAL.ANCHOR_ORIGIN_HORIZONTAL.LEFT,
                        vertical: CONST.MODAL.ANCHOR_ORIGIN_VERTICAL.TOP,
                    }}
                    containerStyles={[{maxHeight: windowHeight / 2}, styles.mw100, shouldUseNarrowLayout ? {} : styles.wFitContent]}
                    onModalHide={onDelegatorMenuHidden}
                >
                    <PopoverMenu.Header style={styles.pt0}>{translate('delegate.switchAccount')}</PopoverMenu.Header>
                    {shouldShowSearchInput && (
                        <CopilotSearchInput
                            value={searchValue}
                            onChangeText={setSearchValue}
                            label={translate('common.search')}
                        />
                    )}
                    {filteredRows.map(({login, itemProps}) => (
                        <PopoverMenu.RadioItem
                            key={login}
                            {...itemProps}
                        />
                    ))}
                    {hasNoSearchResults && <PopoverMenu.Label text={translate('common.noResultsFound')} />}
                </PopoverMenu.ScrollableContent>
            )}
        </PopoverMenu.Root>
    );
}

export default AccountSwitcher;
