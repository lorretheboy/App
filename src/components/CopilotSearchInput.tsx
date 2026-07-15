import {useIsAtActiveLevel} from '@components/PopoverMenu/v2';
import TextInput from '@components/TextInput';

import useThemeStyles from '@hooks/useThemeStyles';

import CONST from '@src/CONST';

import React from 'react';
import {View} from 'react-native';

type CopilotSearchInputProps = {
    /** Current search text */
    value: string;

    /** Called whenever the search text changes */
    onChangeText: (text: string) => void;

    /** Label displayed above the input */
    label: string;
};

/** Search field composed into the copilot switcher popover. */
function CopilotSearchInput({value, onChangeText, label}: CopilotSearchInputProps) {
    const styles = useThemeStyles();
    const isAtActiveLevel = useIsAtActiveLevel();

    if (!isAtActiveLevel) {
        return null;
    }

    return (
        <View style={[styles.ph5, styles.pb3]}>
            <TextInput
                label={label}
                accessibilityLabel={label}
                role={CONST.ROLE.PRESENTATION}
                value={value}
                onChangeText={onChangeText}
                autoCapitalize="none"
                autoCorrect={false}
                spellCheck={false}
                testID="copilot-search-input"
            />
        </View>
    );
}

export default CopilotSearchInput;
