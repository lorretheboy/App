import {getOwnedPaidPolicies, isPaidGroupPolicy} from '@libs/PolicyUtils';
import {useIsAgentAccount} from '@libs/SessionUtils';

import CONST from '@src/CONST';
import ONYXKEYS from '@src/ONYXKEYS';
import {isEmptyObject} from '@src/types/utils/EmptyObject';

import {useMemo} from 'react';

import useOnyx from './useOnyx';

function useSubscriptionPlan() {
    const [policies] = useOnyx(ONYXKEYS.COLLECTION.POLICY);
    const [userMetadata] = useOnyx(ONYXKEYS.USER_METADATA);
    const isAgentAccount = useIsAgentAccount();

    // Filter workspaces in which user is the owner and the type is either corporate (control) or team (collect).
    // Agent accounts never own a paid policy, so derive the plan from the paid group policies they are a member of.
    const ownerPolicies = useMemo(
        () => (isAgentAccount ? Object.values(policies ?? {}).filter(isPaidGroupPolicy) : getOwnedPaidPolicies(policies, userMetadata?.accountID)),
        [isAgentAccount, policies, userMetadata?.accountID],
    );

    if (isEmptyObject(ownerPolicies)) {
        return null;
    }

    // Check if user has corporate (control) workspace
    const hasControlWorkspace = ownerPolicies.some((policy) => policy?.type === CONST.POLICY.TYPE.CORPORATE);

    // Corporate (control) workspace is supposed to be the higher priority
    return hasControlWorkspace ? CONST.POLICY.TYPE.CORPORATE : CONST.POLICY.TYPE.TEAM;
}

export default useSubscriptionPlan;
