import {Str} from 'expensify-common';
import React, {useMemo} from 'react';
import useLocalize from '@hooks/useLocalize';
import {getUnitTranslationKey} from '@libs/WorkspacesSettingsUtils';
import CONST from '@src/CONST';
import type {Unit} from '@src/types/onyx/Policy';
import SelectionList from './SelectionList';
import RadioListItem from './SelectionList/RadioListItem';

type UnitItemType = {
    value: Unit;
    text: string;
    keyForList: string;
    isSelected: boolean;
};

type UnitPickerProps = {
    defaultValue?: Unit;
    onOptionSelected: (unit: UnitItemType) => void;
};

const units = [CONST.CUSTOM_UNITS.DISTANCE_UNIT_KILOMETERS, CONST.CUSTOM_UNITS.DISTANCE_UNIT_MILES];

function UnitPicker({defaultValue, onOptionSelected}: UnitPickerProps) {
    const {translate} = useLocalize();

    const unitOptions = useMemo(() => {
        const mappedUnits = units.map((unit) => ({
            value: unit as Unit,
            text: Str.recapitalize(translate(getUnitTranslationKey(unit))),
            keyForList: unit,
            isSelected: defaultValue === unit,
        }));

        // Move selected items to the top
        const selectedUnits = mappedUnits.filter((unit) => unit.isSelected);
        const unselectedUnits = mappedUnits.filter((unit) => !unit.isSelected);

        return [...selectedUnits, ...unselectedUnits];
    }, [defaultValue, translate]);

    return (
        <SelectionList
            sections={[{data: unitOptions}]}
            ListItem={RadioListItem}
            onSelectRow={onOptionSelected}
            initiallyFocusedOptionKey={undefined}
        />
    );
}

export default UnitPicker;

export type {UnitItemType};
