import CONST from '@src/CONST';
import type {BankAccountList} from '@src/types/onyx';
import type {ACHDataReimbursementAccount} from '@src/types/onyx/ReimbursementAccount';

import type {OnyxEntry} from 'react-native-onyx';
import type {ValueOf} from 'type-fest';

type ReimbursementAccountStepToOpen = ValueOf<typeof REIMBURSEMENT_ACCOUNT_ROUTE_NAMES> | '';

const REIMBURSEMENT_ACCOUNT_ROUTE_NAMES = {
    COMPANY: 'company',
    PERSONAL_INFORMATION: 'personal-information',
    BENEFICIAL_OWNERS: 'beneficial-owners',
    CONTRACT: 'contract',
    VALIDATE: 'validate',
    ENABLE: 'enable',
    NEW: 'new',
} as const;

/**
 * Returns true if a VBBA exists in any state other than OPEN or LOCKED
 */
const hasInProgressUSDVBBA = (achData?: ACHDataReimbursementAccount): boolean => {
    return !!achData?.bankAccountID && !!achData?.state && achData?.state !== CONST.BANK_ACCOUNT.STATE.OPEN && achData?.state !== CONST.BANK_ACCOUNT.STATE.LOCKED;
};

/** Returns true if user passed first step of flow for non USD VBBA */
const hasInProgressNonUSDVBBA = (achData?: ACHDataReimbursementAccount): boolean => {
    return !!achData?.bankAccountID && !!achData?.created;
};

/**
 * Returns achData.bankAccountID coerced to a number, defaulting to 0 when missing so VBBA API calls avoid NaN from undefined.
 */
function getBankAccountIDAsNumber(achData?: ACHDataReimbursementAccount): number {
    return Number(achData?.bankAccountID ?? CONST.DEFAULT_NUMBER_ID);
}

/**
 * Returns the bank account connected to the given workspace, or undefined when there is no policyID to match against.
 */
function getBankAccountConnectedToWorkspace(bankAccountList: OnyxEntry<BankAccountList>, policyID?: string) {
    if (!policyID) {
        return undefined;
    }

    return Object.values(bankAccountList ?? {}).find((bankAccount) => bankAccount?.accountData?.policyIDs?.includes(policyID));
}

/**
 * Returns the state of the bank account connected to the workspace. The account isn't added to the bank account list until the
 * setup is finished, so the state of the VBBA flow is used as a fallback while it is still in progress.
 */
function getBankAccountState(bankAccountList: OnyxEntry<BankAccountList>, achData?: ACHDataReimbursementAccount, policyID?: string): string {
    return getBankAccountConnectedToWorkspace(bankAccountList, policyID)?.accountData?.state ?? achData?.state ?? '';
}

/**
 * Returns the ID of the bank account connected to the workspace, falling back to the VBBA flow's bank account for the same
 * reason as {@link getBankAccountState}.
 */
function getBankAccountIDForWorkspace(bankAccountList: OnyxEntry<BankAccountList>, achData?: ACHDataReimbursementAccount, policyID?: string): number {
    return getBankAccountConnectedToWorkspace(bankAccountList, policyID)?.accountData?.bankAccountID ?? getBankAccountIDAsNumber(achData);
}

/** Returns true if VBBA flow is in progress */
const hasInProgressVBBA = (achData?: ACHDataReimbursementAccount, isNonUSDWorkspace?: boolean, policyID?: string) => {
    if (policyID && achData?.policyID !== policyID) {
        return false;
    }

    if (isNonUSDWorkspace) {
        return hasInProgressNonUSDVBBA(achData);
    }

    return hasInProgressUSDVBBA(achData);
};

export {getBankAccountIDAsNumber, getBankAccountIDForWorkspace, getBankAccountState, hasInProgressUSDVBBA, hasInProgressVBBA, REIMBURSEMENT_ACCOUNT_ROUTE_NAMES};
export type {ReimbursementAccountStepToOpen};
