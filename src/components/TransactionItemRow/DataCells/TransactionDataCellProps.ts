import type {TransactionWithOptionalSearchFields} from '..';

type TransactionDataCellProps = {
    transactionItem: TransactionWithOptionalSearchFields;
    shouldShowTooltip: boolean;
    shouldUseNarrowLayout?: boolean;
    isPendingDelete?: boolean;
};

export default TransactionDataCellProps;
