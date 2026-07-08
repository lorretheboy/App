import useSearchShouldCalculateTotals from '@hooks/useSearchShouldCalculateTotals';

import {getReimbursableTotal} from '@libs/ReportUtils';
import {isGroupEntry} from '@libs/SearchUIUtils';

import CONST from '@src/CONST';
import ONYXKEYS from '@src/ONYXKEYS';
import type {Report, SearchResults} from '@src/types/onyx';

import type {OnyxEntry} from 'react-native-onyx';
import {useOnyx} from 'react-native-onyx';

import React from 'react';

import {useSearchQueryContext, useSearchResultsContext, useSearchSelectionContext} from './SearchContext';
import SearchPageFooter from './SearchPageFooter';

type SearchSelectionFooterProps = {
    /** The (sorting-aware) results the page is displaying; source of the footer's totals metadata. */
    searchResults: OnyxEntry<SearchResults>;
};

// Self-subscribing footer leaf. Owns the `selectedTransactions` read so a checkbox press re-renders only this
// footer — not SearchPage and the <Search> list it contains.
function SearchSelectionFooter({searchResults}: SearchSelectionFooterProps) {
    const {selectedTransactions, selectedReports, areAllMatchingItemsSelected} = useSearchSelectionContext();
    const {currentSearchResults} = useSearchResultsContext();
    const {currentSearchKey, currentSearchQueryJSON} = useSearchQueryContext();
    const shouldAllowFooterTotals = useSearchShouldCalculateTotals(currentSearchKey, currentSearchQueryJSON?.hash, true);
    const [transactions] = useOnyx(ONYXKEYS.COLLECTION.TRANSACTION, {canBeMissing: true});

    const metadata = searchResults?.search;
    const selectedTransactionsKeys = Object.keys(selectedTransactions ?? {});
    const shouldShowFooter = (!areAllMatchingItemsSelected && selectedTransactionsKeys.length > 0) || (shouldAllowFooterTotals && !!metadata?.count);

    if (!shouldShowFooter) {
        return null;
    }

    const shouldUseClientTotal = !metadata?.count || (selectedTransactionsKeys.length > 0 && !areAllMatchingItemsSelected);
    const selectedTransactionItems = Object.values(selectedTransactions);
    const currency = metadata?.currency ?? selectedTransactionItems.at(0)?.groupCurrency ?? selectedTransactionItems.at(0)?.currency;

    // A report is fully selected exactly when its row is checked (this is the set `deriveSelectedReports` produces).
    // For those reports we take the count/total straight from the report's authoritative sources — the same aggregate
    // the row renders plus a live child count from Onyx — instead of reconstructing them from the frozen per-child
    // entries, so the footer can never drift from the row (even for offline create/edit/delete flows).
    const fullySelectedReportKeys = new Set(selectedReports.map((report) => report.reportID));

    const countedReportKeys = new Set<string>();
    const count = shouldUseClientTotal
        ? selectedTransactionsKeys.reduce((acc, key) => {
              const item = selectedTransactions[key];
              if (item.groupKey && fullySelectedReportKeys.has(item.groupKey)) {
                  if (countedReportKeys.has(item.groupKey)) {
                      return acc;
                  }
                  countedReportKeys.add(item.groupKey);
                  return (
                      acc +
                      Object.values(transactions ?? {}).filter(
                          (transaction) => transaction?.reportID === item.groupKey && transaction?.pendingAction !== CONST.RED_BRICK_ROAD_PENDING_ACTION.DELETE,
                      ).length
                  );
              }
              if (isGroupEntry(key)) {
                  const group = currentSearchResults?.data?.[key];
                  return acc + (group?.count ?? 0);
              }
              if (item.action === CONST.SEARCH.ACTION_TYPES.VIEW && key === item.reportID) {
                  return acc;
              }
              return acc + 1;
          }, 0)
        : metadata?.count;

    const totaledReportKeys = new Set<string>();
    const total = shouldUseClientTotal
        ? selectedTransactionItems.reduce((acc, transaction) => {
              if (transaction.groupKey && fullySelectedReportKeys.has(transaction.groupKey)) {
                  if (totaledReportKeys.has(transaction.groupKey)) {
                      return acc;
                  }
                  totaledReportKeys.add(transaction.groupKey);
                  const report = currentSearchResults?.data?.[`${ONYXKEYS.COLLECTION.REPORT}${transaction.groupKey}`] as OnyxEntry<Report>;
                  return acc - getReimbursableTotal(report);
              }
              return acc - (transaction.groupAmount ?? -Math.abs(transaction.amount));
          }, 0)
        : metadata?.total;

    return (
        <SearchPageFooter
            count={count}
            total={total}
            currency={currency}
        />
    );
}

export default SearchSelectionFooter;
