import React, {useCallback, useEffect, useState} from 'react';
import type {View} from 'react-native';
import Animated, {Keyframe, useAnimatedStyle, useSharedValue, withTiming} from 'react-native-reanimated';
import {scheduleOnRN} from 'react-native-worklets';
import Button from '@components/Button';
import {useMemoizedLazyExpensifyIcons} from '@hooks/useLazyAsset';
import useLocalize from '@hooks/useLocalize';
import useThemeStyles from '@hooks/useThemeStyles';
import {isProcessingReport, isReportApproved} from '@libs/ReportUtils';
import variables from '@styles/variables';
import CONST from '@src/CONST';
import SettlementButton from '.';
import type SettlementButtonProps from './types';

type AnimatedSettlementButtonProps = SettlementButtonProps & {
    isPaidAnimationRunning: boolean;
    onAnimationFinish: () => void;
    isApprovedAnimationRunning: boolean;
    shouldAddTopMargin?: boolean;
    canIOUBePaid: boolean;
};

function AnimatedSettlementButton({
    isPaidAnimationRunning,
    isApprovedAnimationRunning,
    onAnimationFinish,
    shouldAddTopMargin = false,
    isDisabled,
    canIOUBePaid,
    wrapperStyle,
    sentryLabel,
    ...settlementButtonProps
}: AnimatedSettlementButtonProps) {
    const styles = useThemeStyles();
    const {translate} = useLocalize();
    const expensifyIcons = useMemoizedLazyExpensifyIcons(['ThumbsUp', 'Checkmark']);
    const isAnimationRunning = isPaidAnimationRunning || isApprovedAnimationRunning;
    const buttonDuration = isPaidAnimationRunning ? CONST.ANIMATION_PAID_DURATION : CONST.ANIMATION_THUMBS_UP_DURATION;
    const buttonDelay = CONST.ANIMATION_PAID_BUTTON_HIDE_DELAY;
    const gap = styles.expenseAndReportPreviewTextButtonContainer.gap;
    const buttonMarginTop = useSharedValue<number>(gap);
    const height = useSharedValue<number>(variables.componentSizeNormal);
    const [canShow, setCanShow] = useState(true);
    const [minWidth, setMinWidth] = useState<number>(0);

    const containerStyles = useAnimatedStyle(() => ({
        height: height.get(),
        justifyContent: 'center',
        ...(shouldAddTopMargin && {marginTop: buttonMarginTop.get()}),
    }));

    const willShowPaymentButton = canIOUBePaid && isApprovedAnimationRunning;

    // The approve animation finishes on a fixed timer that is independent of Onyx. If the reset lands before the
    // optimistic approval has propagated, the Approve button briefly reappears. Keep the animation running until the
    // report is observed as approved (or moved on to the next approver) so the two sources hand off without a gap.
    const isApprovedReportPropagated = isReportApproved({report: settlementButtonProps.iouReport}) || !isProcessingReport(settlementButtonProps.iouReport);
    const [shouldWaitForApprovedReport, setShouldWaitForApprovedReport] = useState(false);

    const resetAndFinishAnimation = useCallback(() => {
        setMinWidth(0);
        setCanShow(true);
        height.set(variables.componentSizeNormal);
        buttonMarginTop.set(shouldAddTopMargin ? gap : 0);
        onAnimationFinish();
    }, [buttonMarginTop, gap, height, onAnimationFinish, shouldAddTopMargin]);

    const finishAnimationAndReset = () => {
        if (isApprovedAnimationRunning && !isApprovedReportPropagated) {
            setShouldWaitForApprovedReport(true);
            return;
        }
        resetAndFinishAnimation();
    };

    useEffect(() => {
        if (!shouldWaitForApprovedReport || !isApprovedReportPropagated) {
            return;
        }
        setShouldWaitForApprovedReport(false);
        resetAndFinishAnimation();
    }, [shouldWaitForApprovedReport, isApprovedReportPropagated, resetAndFinishAnimation]);

    const onButtonExitComplete: () => void = () => {
        'worklet';

        if (shouldAddTopMargin) {
            buttonMarginTop.set(withTiming(willShowPaymentButton ? gap : 0, {duration: buttonDuration}));
        }
        if (willShowPaymentButton) {
            scheduleOnRN(finishAnimationAndReset);
            return;
        }
        height.set(withTiming(0, {duration: buttonDuration}, () => scheduleOnRN(finishAnimationAndReset)));
    };

    const buttonAnimation = new Keyframe({
        from: {
            opacity: 1,
            transform: [{scale: 1}],
        },
        to: {
            opacity: 0,
            transform: [{scale: 0}],
        },
    })
        .delay(buttonDelay)
        .duration(buttonDuration)
        .withCallback(onButtonExitComplete);

    let icon;
    if (isApprovedAnimationRunning) {
        icon = expensifyIcons.ThumbsUp;
    } else if (isPaidAnimationRunning) {
        icon = expensifyIcons.Checkmark;
    }

    const animatedViewRef = (el: View | null) => {
        if (!el || !isAnimationRunning) {
            return;
        }
        setMinWidth((el as unknown as HTMLElement).getBoundingClientRect?.().width ?? 0);
    };

    useEffect(() => {
        if (!isAnimationRunning) {
            return;
        }
        const timer = setTimeout(() => setCanShow(false), CONST.ANIMATION_PAID_BUTTON_HIDE_DELAY);
        return () => clearTimeout(timer);
    }, [isAnimationRunning]);

    return (
        <Animated.View style={[containerStyles, wrapperStyle, {minWidth}]}>
            {isAnimationRunning && canShow && (
                <Animated.View
                    ref={animatedViewRef}
                    exiting={buttonAnimation}
                >
                    <Button
                        text={isApprovedAnimationRunning ? translate('iou.approved') : translate('iou.paymentComplete')}
                        success
                        icon={icon}
                    />
                </Animated.View>
            )}
            {!isAnimationRunning && (
                <SettlementButton
                    {...settlementButtonProps}
                    wrapperStyle={wrapperStyle}
                    isDisabled={isAnimationRunning || isDisabled}
                    sentryLabel={sentryLabel}
                />
            )}
        </Animated.View>
    );
}

export default AnimatedSettlementButton;
