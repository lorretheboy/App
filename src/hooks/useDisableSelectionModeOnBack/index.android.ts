import {useFocusEffect} from '@react-navigation/native';
import {useCallback} from 'react';
import {BackHandler} from 'react-native';
import type UseDisableSelectionModeOnBackCallback from './type';

// On Android, disable selection mode when the hardware back button is pressed.
// See https://reactnavigation.org/docs/custom-android-back-button-handling for more details
export default function useDisableSelectionModeOnBack(callback: UseDisableSelectionModeOnBackCallback) {
    useFocusEffect(
        useCallback(() => {
            const backHandler = BackHandler.addEventListener('hardwareBackPress', callback);
            return () => backHandler.remove();
        }, [callback]),
    );
}
