import CONST from '@src/CONST';

function findDuplicate(array: string[]): string | null {
    const frequencyCounter: Record<string, number> = {};

    for (const item of array) {
        if (item !== CONST.CSV_IMPORT_COLUMNS.IGNORE) {
            if (frequencyCounter[item]) {
                return item;
            }
            frequencyCounter[item] = (frequencyCounter[item] || 0) + 1;
        }
    }

    return null;
}

/**
 * Detects whether a multi-level tags spreadsheet was produced by the app's export with GL codes in
 * the adjacent column. Such an export lays out each tag list as a "<name>" tag column immediately
 * followed by a "<name> GL" code column, so the data forms a repeated 2-column "tag, code" pattern.
 *
 * @param data - The spreadsheet data in column-major format (each entry is a column, with the header at index 0)
 */
function isMultiLevelTagsGLAdjacent(data: string[][]): boolean {
    // Each tag list occupies a tag column plus its adjacent GL code column, so the columns must come in pairs.
    if (data.length === 0 || data.length % 2 !== 0) {
        return false;
    }

    for (let colIndex = 0; colIndex < data.length; colIndex += 2) {
        const tagHeader = data.at(colIndex)?.at(0)?.trim();
        const glHeader = data.at(colIndex + 1)?.at(0)?.trim();
        if (!tagHeader || glHeader !== `${tagHeader}${CONST.MULTI_LEVEL_TAGS_GL_CODE_HEADER_SUFFIX}`) {
            return false;
        }
    }

    return true;
}

/**
 * Converts a numeric index to an Excel-style column name.
 */
function numberToColumn(index: number): string {
    let column = '';
    let number = index;

    // Loop until 'number' is less than 0
    while (number >= 0) {
        // Calculate the character corresponding to the current 'number' and prepend it to the 'column' string
        column = String.fromCharCode((number % 26) + 65) + column;
        // Update 'number' to move to the next significant digit in base-26, adjusting for 0-based index
        number = Math.floor(number / 26) - 1;
    }
    return column;
}

/**
 * Generates an array of Excel-style column names with a specified length.
 */
function generateColumnNames(length: number) {
    return Array.from({length}, (_, i) => numberToColumn(i));
}

export {findDuplicate, generateColumnNames, isMultiLevelTagsGLAdjacent};
