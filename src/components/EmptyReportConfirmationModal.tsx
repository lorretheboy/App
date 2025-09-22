import React, {useState} from 'react';
import {View} from 'react-native';
import useLocalize from '@hooks/useLocalize';
import useThemeStyles from '@hooks/useThemeStyles';
import {setNameValuePair} from '@userActions/User';
import ONYXKEYS from '@src/ONYXKEYS';
import CheckboxWithLabel from './CheckboxWithLabel';
import ConfirmModal from './ConfirmModal';
import Text from './Text';

type EmptyReportConfirmationModalProps = {
    /** Whether the modal is visible */
    isVisible: boolean;

    /** Function to call when the user confirms creating a new report */
    onConfirm: () => void;

    /** Function to call when the user cancels */
    onCancel: () => void;
};

function EmptyReportConfirmationModal({isVisible, onConfirm, onCancel}: EmptyReportConfirmationModalProps) {
    const {translate} = useLocalize();
    const styles = useThemeStyles();
    const [dontShowAgain, setDontShowAgain] = useState(false);

    const handleConfirm = () => {
        if (dontShowAgain) {
            setNameValuePair(ONYXKEYS.NVP_DISMISSED_EMPTY_REPORT_CONFIRMATION, true, false);
        }
        onConfirm();
    };

    const handleCancel = () => {
        if (dontShowAgain) {
            setNameValuePair(ONYXKEYS.NVP_DISMISSED_EMPTY_REPORT_CONFIRMATION, true, false);
        }
        onCancel();
    };

    return (
        <ConfirmModal
            isVisible={isVisible}
            onConfirm={handleConfirm}
            onCancel={handleCancel}
            title={translate('report.newReport.emptyReportConfirmation.title')}
            confirmText={translate('report.newReport.emptyReportConfirmation.createReport')}
            cancelText={translate('report.newReport.emptyReportConfirmation.cancel')}
            shouldShowCancelButton
            prompt={
                <View>
                    <Text style={[styles.mb4]}>{translate('report.newReport.emptyReportConfirmation.message')}</Text>
                    <CheckboxWithLabel
                        isChecked={dontShowAgain}
                        onInputChange={(value) => setDontShowAgain(!!value)}
                        label={translate('report.newReport.emptyReportConfirmation.dontShowAgain')}
                    />
                </View>
            }
        />
    );
}

EmptyReportConfirmationModal.displayName = 'EmptyReportConfirmationModal';

export default EmptyReportConfirmationModal;
