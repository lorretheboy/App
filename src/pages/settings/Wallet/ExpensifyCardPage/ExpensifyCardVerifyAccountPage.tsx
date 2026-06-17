import {useNavigationState} from '@react-navigation/native';
import React, {useEffect, useRef, useState} from 'react';
import {useOnyx} from 'react-native-onyx';
import ValidateCodeActionContent from '@components/ValidateCodeActionModal/ValidateCodeActionContent';
import useLocalize from '@hooks/useLocalize';
import usePrimaryContactMethod from '@hooks/usePrimaryContactMethod';
import {revealVirtualCardDetails} from '@libs/actions/Card';
import {requestValidateCodeAction, resetValidateActionCodeSent} from '@libs/actions/User';
import {getMicroSecondOnyxErrorWithTranslationKey} from '@libs/ErrorUtils';
import Navigation from '@libs/Navigation/Navigation';
import type {PlatformStackScreenProps} from '@libs/Navigation/PlatformStackNavigation/types';
import type {DomainCardNavigatorParamList, SettingsNavigatorParamList} from '@libs/Navigation/types';
import {isSingleNewDotEntrySelector} from '@selectors/HybridApp';
import type {TranslationPaths} from '@src/languages/types';
import ONYXKEYS from '@src/ONYXKEYS';
import ROUTES from '@src/ROUTES';
import SCREENS from '@src/SCREENS';
import type {ExpensifyCardDetails} from '@src/types/onyx/Card';
import type {Errors} from '@src/types/onyx/OnyxCommon';
import {useExpensifyCardActions} from './ExpensifyCardContextProvider';

type ExpensifyCardVerifyAccountPageProps =
    | PlatformStackScreenProps<SettingsNavigatorParamList, typeof SCREENS.SETTINGS.WALLET.DOMAIN_CARD_CONFIRM_MAGIC_CODE>
    | PlatformStackScreenProps<DomainCardNavigatorParamList, typeof SCREENS.DOMAIN_CARD.DOMAIN_CARD_CONFIRM_MAGIC_CODE>;

function ExpensifyCardVerifyAccountPage({route}: ExpensifyCardVerifyAccountPageProps) {
    const {cardID} = route.params;
    const {translate} = useLocalize();
    const [validateError, setValidateError] = useState<Errors>({});
    const primaryLogin = usePrimaryContactMethod();
    const {setIsCardDetailsLoading, setCardsDetails, setCardsDetailsErrors} = useExpensifyCardActions();
    const [isSingleNewDotEntry = false] = useOnyx(ONYXKEYS.HYBRID_APP, {selector: isSingleNewDotEntrySelector});
    const isDomainCardDetailInStack = useNavigationState((state) => state.routes.some((stackRoute) => stackRoute.name === SCREENS.DOMAIN_CARD.DOMAIN_CARD_DETAIL));

    // When OldDot deep-links straight into the magic-code screen as the single NewDot entry, the Domain Card navigator stack
    // has no details page beneath it. Redirect to the details page so the user lands there (and the single-entry back guard
    // returns to OldDot from it) instead of seeing the bare magic-code field. Normal in-app navigation always has the details
    // page in the stack and/or is not a single entry, so the redirect never runs.
    const hasRedirectedRef = useRef(false);
    useEffect(() => {
        if (hasRedirectedRef.current) {
            return;
        }
        if (route.name !== SCREENS.DOMAIN_CARD.DOMAIN_CARD_CONFIRM_MAGIC_CODE || !isSingleNewDotEntry || isDomainCardDetailInStack) {
            return;
        }
        hasRedirectedRef.current = true;
        Navigation.navigate(ROUTES.SETTINGS_DOMAIN_CARD_DETAIL.getRoute(cardID), {forceReplace: true});
    }, [cardID, isDomainCardDetailInStack, isSingleNewDotEntry, route.name]);

    const navigateBack = () => {
        if (route.name === SCREENS.DOMAIN_CARD.DOMAIN_CARD_CONFIRM_MAGIC_CODE) {
            Navigation.goBack(ROUTES.SETTINGS_DOMAIN_CARD_DETAIL.getRoute(cardID));
            return;
        }
        Navigation.goBack(ROUTES.SETTINGS_WALLET_DOMAIN_CARD.getRoute(cardID));
    };

    const handleRevealCardDetails = (validateCode: string) => {
        setIsCardDetailsLoading((prevState: Record<number, boolean>) => ({
            ...prevState,
            [cardID]: true,
        }));
        // We can't store the response in Onyx for security reasons.
        // That is why this action is handled manually and the response is stored in a local state.
        // Hence eslint disable here.

        revealVirtualCardDetails(Number.parseInt(cardID, 10), validateCode)
            .then((value) => {
                setCardsDetails((prevState: Record<number, ExpensifyCardDetails | null>) => ({...prevState, [cardID]: value}));
                setCardsDetailsErrors((prevState) => ({
                    ...prevState,
                    [cardID]: '',
                }));
                navigateBack();
            })
            .catch((error: TranslationPaths) => {
                setValidateError(getMicroSecondOnyxErrorWithTranslationKey(error));
            })
            .finally(() => {
                setIsCardDetailsLoading((prevState: Record<number, boolean>) => ({...prevState, [cardID]: false}));
            });
    };

    return (
        <ValidateCodeActionContent
            title={translate('cardPage.validateCardTitle')}
            descriptionPrimary={translate('cardPage.enterMagicCode', primaryLogin)}
            sendValidateCode={() => requestValidateCodeAction()}
            validateCodeActionErrorField="revealExpensifyCardDetails"
            handleSubmitForm={handleRevealCardDetails}
            validateError={validateError}
            clearError={() => setValidateError({})}
            onClose={() => {
                resetValidateActionCodeSent();
                navigateBack();
            }}
        />
    );
}

export default ExpensifyCardVerifyAccountPage;
