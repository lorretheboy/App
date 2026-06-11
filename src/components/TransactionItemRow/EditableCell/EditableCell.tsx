import React, {useDeferredValue, useEffect, useId} from 'react';
import type {ReactNode, RefObject} from 'react';
import {View} from 'react-native';
import Hoverable from '@components/Hoverable';
import Icon from '@components/Icon';
import PressableWithFeedback from '@components/Pressable/PressableWithFeedback';
import {useMemoizedLazyExpensifyIcons} from '@hooks/useLazyAsset';
import useResponsiveLayoutOnWideRHP from '@hooks/useResponsiveLayoutOnWideRHP';
import useTheme from '@hooks/useTheme';
import useThemeStyles from '@hooks/useThemeStyles';
import CONST from '@src/CONST';
import variables from '@styles/variables';
import {useEditingCellActions} from './EditingCellContext';

type EditableCellProps = {
    /** Content to display when not editing */
    children: ReactNode;

    /** Content to display when editing (inline replacement like TextInput). If omitted while isEditing, children are shown with an active border (popover mode). */
    editContent?: ReactNode;

    /** Popover or modal rendered as a sibling to the cell (e.g. date picker, category picker). Rendered for all edit-capable branches. */
    popoverContent?: ReactNode;

    /** Whether the cell is currently in editing mode */
    isEditing: boolean;

    /**
     * Whether editing is currently permitted.
     * Only meaningful when the layout supports editing. When false the styled container is still rendered (maintaining layout
     * consistency) but the pressable is disabled and editing cannot be triggered.
     */
    canEdit?: boolean;

    /** Callback when edit mode should be activated */
    onStartEditing: () => void;

    /** Ref attached to the cell wrapper — used as popover anchor for date/category pickers */
    anchorRef?: RefObject<View | null>;

    /** Whether the edit icon should be positioned at the leading (left) edge instead of the trailing (right) edge — used for right-aligned cells */
    shouldShowEditIconOnLeft?: boolean;
};

/**
 * A stateless wrapper that handles hover highlight + click-to-edit for table cells.
 * Does not manage editing state — the consumer controls that via hooks.
 *
 * Modes:
 *   1. isEditable=false           → renders children as-is (narrow/mobile layout — no container needed)
 *   2. isEditing + editContent    → replaces children with editContent (inline edit)
 *   3. isEditing + no editContent → shows children with active border (popover edit)
 *   4. canEdit=false              → styled container View, no pressable (transient: loading / no permission)
 *   5. default                    → PressableWithFeedback (hover border, click triggers edit)
 */
function EditableCell({children, editContent, popoverContent, isEditing, canEdit, onStartEditing, anchorRef, shouldShowEditIconOnLeft}: EditableCellProps) {
    const styles = useThemeStyles();
    const theme = useTheme();
    const {isLargeScreenWidth, shouldUseNarrowLayout} = useResponsiveLayoutOnWideRHP();
    const isEditable = isLargeScreenWidth && !shouldUseNarrowLayout;
    const cellId = useId();
    const {setIsEditingCell, setFocusedCellId} = useEditingCellActions();
    const isInteractive = useDeferredValue(true, false);
    const lazyIcons = useMemoizedLazyExpensifyIcons(['Pencil']);

    useEffect(() => {
        if (!isEditable || !isEditing) {
            return;
        }
        setIsEditingCell(true);
        return () => setIsEditingCell(false);
    }, [isEditing, isEditable, setIsEditingCell]);

    // Architectural exclusion (e.g. narrow layout) — no container, no padding.
    if (!isEditable) {
        return children;
    }

    // Inline edit mode: replace display content with the edit input
    if (isEditing && editContent) {
        return <View style={[styles.editableCell, styles.editableCellFocus]}>{editContent}</View>;
    }

    // Popover edit mode: keep showing display content with active border
    if (isEditing && popoverContent) {
        return (
            <>
                <View
                    ref={anchorRef}
                    style={[styles.editableCell, styles.editableCellFocus]}
                >
                    {children}
                </View>
                {popoverContent}
            </>
        );
    }

    // Render a layout-identical plain View when editing isn't permitted OR while the
    // PressableWithFeedback tree is deferred.  This avoids mounting the expensive
    // Tooltip / Hoverable / BoundsObserver subtree during the initial skeleton render,
    // unblocking the main thread so the network response can be processed sooner.
    if (!canEdit || !isInteractive) {
        return <View style={[styles.editableCell]}>{children}</View>;
    }

    // Render the children as plain, non-interactive content so a press on the cell falls through to the
    // row's own handler (opening the expense/report). A small edit-icon button is revealed on hover and is
    // the only target that triggers editing.
    return (
        <Hoverable>
            {(isHovered) => (
                <View style={styles.editableCell}>
                    {children}
                    {isHovered && (
                        <PressableWithFeedback
                            accessibilityRole={CONST.ROLE.BUTTON}
                            accessibilityLabel="Edit cell"
                            sentryLabel={CONST.SENTRY_LABEL.TABLE.EDITABLE_CELL}
                            onPress={onStartEditing}
                            onFocus={() => setFocusedCellId(cellId)}
                            onBlur={() => setFocusedCellId(null)}
                            style={[styles.editableCellEditIcon, shouldShowEditIconOnLeft ? styles.l0 : styles.r0]}
                            focusStyle={styles.editableCellFocus}
                        >
                            <Icon
                                src={lazyIcons.Pencil}
                                height={variables.iconSizeSmall}
                                width={variables.iconSizeSmall}
                                fill={theme.icon}
                            />
                        </PressableWithFeedback>
                    )}
                </View>
            )}
        </Hoverable>
    );
}

EditableCell.displayName = 'EditableCell';

export default EditableCell;
