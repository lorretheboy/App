import type {TableData, TableHandle} from '@components/Table';

import {clearDomainHighlightItems} from '@libs/actions/Domain';

import ONYXKEYS from '@src/ONYXKEYS';
import type {DomainHighlightItemType} from '@src/types/onyx/DomainHighlightItems';

import type {RefObject} from 'react';

import {useIsFocused} from '@react-navigation/native';
import {useEffect, useState} from 'react';

import useOnyx from './useOnyx';

/**
 * Scrolls to and highlights a domain admin/member/group row after it was just added, by reading the
 * pending highlight flag set optimistically in `Domain.ts` and consuming it once the row is visible.
 * If the row is currently hidden by an active search/filter, those are cleared so that it becomes visible.
 */
function useDomainHighlightOnReturn<DataType extends TableData, ColumnKey extends string = string, FilterKey extends string = string>(
    domainAccountID: number,
    type: DomainHighlightItemType,
    tableRef: RefObject<TableHandle<DataType, ColumnKey, FilterKey> | null>,
) {
    const isFocused = useIsFocused();
    const [highlightItems] = useOnyx(`${ONYXKEYS.COLLECTION.DOMAIN_HIGHLIGHT_ITEMS}${domainAccountID}`);
    const highlightKey = highlightItems?.type === type ? highlightItems.id : null;
    const [resetViewCount, setResetViewCount] = useState(0);

    useEffect(() => {
        if (!isFocused || !highlightKey) {
            return;
        }

        const processedData = tableRef.current?.getProcessedData() ?? [];
        const index = processedData.findIndex((item) => item.keyForList === highlightKey);

        if (index === -1) {
            const activeFilters = tableRef.current?.getActiveFilters();
            const activeFilterKeys = Object.keys(activeFilters ?? {}) as FilterKey[];
            const hasActiveSearchOrFilters = !!tableRef.current?.getActiveSearchString() || activeFilterKeys.some((key) => !!activeFilters?.[key].length);

            if (!hasActiveSearchOrFilters) {
                // The row genuinely isn't in the table, so drop the pending highlight.
                clearDomainHighlightItems(domainAccountID);
                return;
            }

            // The row is hidden by an active search/filter, so clear them to reveal it. Clearing only re-renders the
            // table, so bump the state to run this effect again once the row is part of the processed data.
            tableRef.current?.updateSearchString('');
            for (const key of activeFilterKeys) {
                tableRef.current?.updateFilter({key, value: []});
            }
            setResetViewCount((count) => count + 1);
            return;
        }

        tableRef.current?.scrollToIndex({index, animated: false});
        tableRef.current?.highlightItems([highlightKey]);
        clearDomainHighlightItems(domainAccountID);
    }, [isFocused, highlightKey, domainAccountID, tableRef, resetViewCount]);
}

export default useDomainHighlightOnReturn;
