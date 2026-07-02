import type {ConfirmButtonOptions, ListItem} from '@components/SelectionList/types';
import useActiveElementRole from '@hooks/useActiveElementRole';
import useKeyboardShortcut from '@hooks/useKeyboardShortcut';
import CONST from '@src/CONST';

type UseSelectionListShortcutsParams<TItem extends ListItem> = {
    selectFocusedItem: () => void;
    getFocusedOption: () => TItem | undefined;
    confirmButtonOptions: ConfirmButtonOptions<TItem> | undefined;
    isActive: boolean;
    focusedIndex: number;
    disableKeyboardShortcuts: boolean;
    shouldStopPropagation: boolean | undefined;
    shouldBubble: boolean;

    /** Whether pressing Enter should confirm the current selection (open "Next") instead of toggling the focused row */
    shouldConfirmOnEnter: boolean;
};

/** Registers a SelectionList's Enter / Ctrl+Enter shortcuts, disabling Enter while an interactive element is focused. */
function useSelectionListShortcuts<TItem extends ListItem>({
    selectFocusedItem,
    getFocusedOption,
    confirmButtonOptions,
    isActive,
    focusedIndex,
    disableKeyboardShortcuts,
    shouldStopPropagation,
    shouldBubble,
    shouldConfirmOnEnter,
}: UseSelectionListShortcutsParams<TItem>) {
    const activeElementRole = useActiveElementRole();
    const disableEnterShortcut = activeElementRole && [CONST.ROLE.BUTTON, CONST.ROLE.CHECKBOX, CONST.ROLE.SWITCH].some((role) => role === activeElementRole);

    useKeyboardShortcut(
        CONST.KEYBOARD_SHORTCUTS.ENTER,
        (e) => {
            // A row that is only focused because of a mouse click on an empty search box isn't visually highlighted,
            // so Enter should confirm the current selection (e.g. open "Next") rather than toggle/deselect that row.
            if (shouldConfirmOnEnter) {
                confirmButtonOptions?.onConfirm?.(e, getFocusedOption());
                return;
            }
            selectFocusedItem();
        },
        {
            captureOnInputs: true,
            shouldBubble,
            shouldStopPropagation,
            isActive: !disableKeyboardShortcuts && isActive && focusedIndex >= 0 && !disableEnterShortcut,
        },
    );

    useKeyboardShortcut(
        CONST.KEYBOARD_SHORTCUTS.CTRL_ENTER,
        (e) => {
            if (confirmButtonOptions?.onConfirm) {
                confirmButtonOptions.onConfirm(e, getFocusedOption());
                return;
            }
            selectFocusedItem();
        },
        {
            captureOnInputs: true,
            shouldBubble,
            isActive: !disableKeyboardShortcuts && isActive && !confirmButtonOptions?.isDisabled,
        },
    );
}

export default useSelectionListShortcuts;
