import type {SearchQueryString} from '@components/Search/types';

type ExportSearchWithTemplateParams = {
    templateName: string;
    templateType: string;
    jsonQuery: SearchQueryString;
    reportIDList: string[];
    transactionIDList: string[];
    policyID: string | undefined;
    /** Rows excluded from a "select all matching" export, so the backend skips them. */
    excludedTransactionIDList?: string[];
};

export default ExportSearchWithTemplateParams;
