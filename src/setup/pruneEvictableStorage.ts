import OnyxCache from 'react-native-onyx/dist/OnyxCache';
import OnyxKeys from 'react-native-onyx/dist/OnyxKeys';
import OnyxUtils from 'react-native-onyx/dist/OnyxUtils';
import Log from '@libs/Log';

/**
 * Maximum number of evictable Onyx members (report actions, drafts, pages, and reactions) to keep on
 * disk. Evictable data is safe to drop because it is re-fetched from the server on demand, but on
 * native it is otherwise only trimmed when a storage write fails — which effectively never happens
 * with SQLite. Bounding the count here keeps disk usage, the in-memory Onyx cache, and the derived
 * values computed from report actions from growing without limit as an install ages.
 */
const MAX_CACHED_EVICTABLE_KEYS = 1000;

/**
 * Proactively trim the least recently accessed members of the evictable Onyx collections down to a
 * fixed cap. Must run after Onyx has seeded its recently-accessed tracking (hence `afterInit`) and
 * before any full-collection subscriptions pin the data in memory.
 */
function pruneEvictableStorage(): Promise<void> {
    return OnyxUtils.afterInit(() =>
        OnyxUtils.getAllKeys().then((keys) => {
            let evictableKeyCount = 0;
            for (const key of keys) {
                if (OnyxKeys.isCollectionKey(key) || !OnyxCache.isEvictableKey(key)) {
                    continue;
                }
                evictableKeyCount++;
            }

            let evictedCount = 0;
            while (evictableKeyCount > MAX_CACHED_EVICTABLE_KEYS) {
                const keyToEvict = OnyxCache.getKeyForEviction();
                if (!keyToEvict) {
                    break;
                }
                OnyxUtils.remove(keyToEvict);
                evictableKeyCount--;
                evictedCount++;
            }

            if (evictedCount > 0) {
                Log.info(`[pruneEvictableStorage] Trimmed ${evictedCount} least recently accessed evictable keys`);
            }
        }),
    );
}

export default pruneEvictableStorage;
