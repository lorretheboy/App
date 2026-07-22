import type {ConfirmModalProps} from '@components/ConfirmModal';
import ConfirmModal from '@components/ConfirmModal';

import useActiveElementRole from '@hooks/useActiveElementRole';
import useKeyboardShortcut from '@hooks/useKeyboardShortcut';

import CONST from '@src/CONST';

import React, {useState} from 'react';

import type {ModalProps} from './ModalContext';

import {ModalActions} from './ModalContext';

type ConfirmModalWrapperProps = ModalProps & Omit<ConfirmModalProps, 'onConfirm' | 'onCancel' | 'isVisible'>;

// This wrapper bridges the ConfirmModal API with the global modal system, providing handlers for the onConfirm and onCancel callbacks to ConfirmModal.
// TODOS after migrating all ConfirmModal instances to use showConfirmModal:
// - handle closeModal inside ConfirmModal
// - remove ConfirmModalWrapper

function ConfirmModalWrapper({closeModal, onModalHide, resolveModal, removeModal, isHiding, ...props}: ConfirmModalWrapperProps) {
    const activeElementRole = useActiveElementRole();
    const [isVisible, setIsVisible] = useState(true);
    const [closeAction, setCloseAction] = useState<typeof ModalActions.CONFIRM | typeof ModalActions.CLOSE>(ModalActions.CLOSE);
    const [isConfirmLoading, setIsConfirmLoading] = useState(false);

    // The modal is effectively hidden either when the wrapper closes it locally (isVisible === false)
    // or when the global context asks it to hide (isHiding === true, e.g. a caller called closeModal()).
    const isModalVisible = isVisible && !isHiding;

    const handleConfirm = () => {
        setCloseAction(ModalActions.CONFIRM);
        // If isConfirmLoading is passed, don't close immediately - show loading state instead
        // The caller should use closeModal() from useConfirmModal when the async operation completes
        if (props.isConfirmLoading !== undefined) {
            setIsConfirmLoading(true);
            // Resolve the promise so the caller's .then() handler can start the async operation
            // The modal stays visible with loading state until closeModal() is called
            resolveModal({action: ModalActions.CONFIRM});
        } else {
            setIsVisible(false);
        }
    };

    const handleCancel = () => {
        setCloseAction(ModalActions.CLOSE);
        setIsVisible(false);
    };

    const handleModalHide = () => {
        if (isModalVisible) {
            return;
        }
        // Resolve the modal promise (no-op if already resolved) and only then remove the entry from the stack,
        // so the entry leaves once the modal has finished hiding rather than while it is still on screen.
        resolveModal({action: closeAction});
        removeModal();
        onModalHide?.();
    };

    const shortcutConfig = {
        isActive: activeElementRole !== CONST.ROLE.BUTTON && !isConfirmLoading,
        shouldPreventDefault: false,
        shouldBubble: false,
    };

    useKeyboardShortcut(CONST.KEYBOARD_SHORTCUTS.ENTER, handleConfirm, shortcutConfig);

    return (
        <ConfirmModal
            {...props}
            isVisible={isModalVisible}
            onConfirm={handleConfirm}
            onCancel={handleCancel}
            onModalHide={handleModalHide}
            isConfirmLoading={isConfirmLoading || props.isConfirmLoading}
        />
    );
}

export default ConfirmModalWrapper;
