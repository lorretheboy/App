type MarkAsExportedParams = {
    markedManually: boolean;
    /**
     * Stringified JSON object with type of following structure:
     * Array<{
     *   reportID: number;
     *   label: string;
     *   optimisticReportActionID: string;
     * }>
     */
    data: string;

    /** Serialized search query used to mark every matching report as exported when all matching items are selected */
    jsonQuery?: string;
};

export default MarkAsExportedParams;
