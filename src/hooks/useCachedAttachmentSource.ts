import {useEffect, useState} from 'react';
import {getCachedAttachment} from '@libs/actions/Attachment';
import {isLocalFile} from '@libs/fileDownload/FileUtils';
import getNonEmptyStringOnyxID from '@libs/getNonEmptyStringOnyxID';
import ONYXKEYS from '@src/ONYXKEYS';
import useOnyx from './useOnyx';

/**
 * Resolves the displayed source for an attachment that may carry a stale local
 * (blob:/file:) URI. Object URLs are revoked when the page unloads, so the
 * persisted src of an attachment uploaded offline resolves to nothing after a
 * reload. When the attachment has an attachmentID and its current source is a
 * local URI, this reads the cached bytes back and returns a fresh object URL.
 */
function useCachedAttachmentSource(attachmentID: string | undefined, source: string | undefined): string | undefined {
    const [attachment] = useOnyx(`${ONYXKEYS.COLLECTION.ATTACHMENT}${getNonEmptyStringOnyxID(attachmentID)}`);
    const [resolvedSource, setResolvedSource] = useState(source);

    useEffect(() => {
        if (!attachmentID || !source || !isLocalFile(source)) {
            setResolvedSource(source);
            return;
        }

        let isActive = true;
        getCachedAttachment({attachmentID, attachment, currentSource: source}).then((cachedSource) => {
            if (!isActive) {
                return;
            }
            setResolvedSource(cachedSource);
        });

        return () => {
            isActive = false;
        };
    }, [attachmentID, source, attachment]);

    return resolvedSource;
}

export default useCachedAttachmentSource;
