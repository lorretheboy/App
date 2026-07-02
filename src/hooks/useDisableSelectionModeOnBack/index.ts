import {useIsFocused} from '@react-navigation/native';
import {useEffect, useRef} from 'react';
import useBeforeRemove from '@hooks/useBeforeRemove';
import type UseDisableSelectionModeOnBackCallback from './type';

// On web, the browser back button bypasses the Android hardware back handling, so intercept the navigation removal
// with `beforeRemove` and restore the consumed history entry on popstate, mirroring `useDiscardChangesConfirmation`.
export default function useDisableSelectionModeOnBack(callback: UseDisableSelectionModeOnBackCallback) {
    const isFocused = useIsFocused();
    const isRestoringHistory = useRef(false);
    const didPreventResetOnPopstate = useRef(false);

    useBeforeRemove((e) => {
        if (isRestoringHistory.current) {
            // The `history.go(1)` restoring the browser entry can re-deliver a reset for the current state; swallow it without re-blocking
            e.preventDefault();
            return;
        }

        // Only the focused screen should react — a flow-leave reset fires `beforeRemove` for hidden siblings too
        if (!isFocused) {
            return;
        }

        // The callback returns false when selection mode isn't enabled; otherwise it clears the selection, turns off selection mode and returns true
        if (!callback()) {
            return;
        }

        e.preventDefault();
        if (e.data.action.type === 'RESET') {
            // A prevented RESET comes from a browser back; the popstate listener must restore the URL
            didPreventResetOnPopstate.current = true;
        }
    });

    useEffect(() => {
        const handlePopState = () => {
            if (isRestoringHistory.current) {
                isRestoringHistory.current = false;
                return;
            }
            if (didPreventResetOnPopstate.current) {
                didPreventResetOnPopstate.current = false;
                isRestoringHistory.current = true;
                window.history.go(1);
            }
        };

        window.addEventListener('popstate', handlePopState);
        return () => window.removeEventListener('popstate', handlePopState);
    }, []);
}
