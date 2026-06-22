import type {SearchQueryString, SearchStatus} from '@components/Search/types';

type ExportSearchItemsToCSVParams = {
    query: SearchStatus;
    jsonQuery: SearchQueryString;
    reportIDList: string[];
    transactionIDList: string[];
    isBasicExport: boolean;
    exportColumnLabels: string;
    /** Rows excluded from a "select all matching" export, so the backend skips them. */
    excludedTransactionIDList?: string[];
};

export default ExportSearchItemsToCSVParams;
