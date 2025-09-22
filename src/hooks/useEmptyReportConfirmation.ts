import {useCallback, useState} from 'react';
import {createNewReport, shouldShowEmptyReportConfirmationModal} from '@userActions/Report';
import ONYXKEYS from '@src/ONYXKEYS';
import type {PersonalDetails} from '@src/types/onyx';
import useOnyx from './useOnyx';

type UseEmptyReportConfirmationProps = {
    /** The creator's personal details */
    creatorPersonalDetails: PersonalDetails;

    /** Whether to notify new action */
    shouldNotifyNewAction?: boolean;

    /** Callback to execute after report is created */
    onReportCreated?: (reportID: string) => void;
};

type UseEmptyReportConfirmationReturn = {
    /** Whether the confirmation modal should be visible */
    isModalVisible: boolean;

    /** Function to call when user wants to create a report */
    createReportWithConfirmation: (policyID?: string) => void;

    /** Function to call when user confirms creating the report */
    confirmCreateReport: () => void;

    /** Function to call when user cancels creating the report */
    cancelCreateReport: () => void;
};

/**
 * Hook to handle empty report confirmation logic
 */
function useEmptyReportConfirmation({
    creatorPersonalDetails,
    shouldNotifyNewAction = false,
    onReportCreated,
}: UseEmptyReportConfirmationProps): UseEmptyReportConfirmationReturn {
    const [isModalVisible, setIsModalVisible] = useState(false);
    const [currentPolicyID, setCurrentPolicyID] = useState<string | undefined>();
    const [isDismissed] = useOnyx(ONYXKEYS.NVP_DISMISSED_EMPTY_REPORT_CONFIRMATION);

    const createReport = useCallback((policyID?: string) => {
        const reportID = createNewReport(creatorPersonalDetails, policyID, shouldNotifyNewAction);
        onReportCreated?.(reportID);
        return reportID;
    }, [creatorPersonalDetails, shouldNotifyNewAction, onReportCreated]);

    const createReportWithConfirmation = useCallback((policyID?: string) => {
        const currentUserAccountID = creatorPersonalDetails?.accountID;

        if (shouldShowEmptyReportConfirmationModal(policyID, currentUserAccountID, isDismissed)) {
            setCurrentPolicyID(policyID);
            setIsModalVisible(true);
        } else {
            createReport(policyID);
        }
    }, [creatorPersonalDetails?.accountID, isDismissed, createReport]);

    const confirmCreateReport = useCallback(() => {
        setIsModalVisible(false);
        createReport(currentPolicyID);
    }, [createReport, currentPolicyID]);

    const cancelCreateReport = useCallback(() => {
        setIsModalVisible(false);
    }, []);

    return {
        isModalVisible,
        createReportWithConfirmation,
        confirmCreateReport,
        cancelCreateReport,
    };
}

export default useEmptyReportConfirmation;
