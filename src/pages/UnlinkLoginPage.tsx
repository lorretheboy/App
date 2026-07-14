import FullScreenLoadingIndicator from '@components/FullscreenLoadingIndicator';

import useOnyx from '@hooks/useOnyx';
import usePrevious from '@hooks/usePrevious';

import Navigation, {navigationRef} from '@libs/Navigation/Navigation';
import type {PlatformStackScreenProps} from '@libs/Navigation/PlatformStackNavigation/types';
import type {SkeletonSpanReasonAttributes} from '@libs/telemetry/useSkeletonSpan';

import type {PublicScreensParamList} from '@navigation/types';

import {unlinkLogin} from '@userActions/Session';

import CONST from '@src/CONST';
import NAVIGATORS from '@src/NAVIGATORS';
import ONYXKEYS from '@src/ONYXKEYS';
import type SCREENS from '@src/SCREENS';

import React, {useEffect} from 'react';

type UnlinkLoginPageProps = PlatformStackScreenProps<PublicScreensParamList, typeof SCREENS.UNLINK_LOGIN>;

function UnlinkLoginPage({route}: UnlinkLoginPageProps) {
    const accountID = route.params.accountID ?? CONST.DEFAULT_NUMBER_ID;
    const validateCode = route.params.validateCode ?? '';
    const [account] = useOnyx(ONYXKEYS.ACCOUNT);
    const prevIsLoading = usePrevious(!!account?.isLoading);

    useEffect(() => {
        unlinkLogin(Number(accountID), validateCode);
        // We only want this to run on mount
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        // Only navigate when the unlink login request is completed
        if (!prevIsLoading || account?.isLoading) {
            return;
        }

        // This page is reached via the unlink email deep link, so it's the only route in the stack and goBack() no-ops.
        // Reset to TAB_NAVIGATOR (which hosts the public SignInPage) so the success message from account.message is shown.
        Navigation.isNavigationReady().then(() => {
            navigationRef.reset({index: 0, routes: [{name: NAVIGATORS.TAB_NAVIGATOR}]});
        });
    }, [prevIsLoading, account?.isLoading]);

    const reasonAttributes: SkeletonSpanReasonAttributes = {
        context: 'UnlinkLoginPage',
    };
    return <FullScreenLoadingIndicator reasonAttributes={reasonAttributes} />;
}

export default UnlinkLoginPage;
