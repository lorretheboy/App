import Log from '@libs/Log';
import {endSpan, getSpan, startSpan} from '@libs/telemetry/activeSpans';

import CONST from '@src/CONST';
import IntlStore from '@src/languages/IntlStore';
import ONYXKEYS from '@src/ONYXKEYS';
import ObjectUtils from '@src/types/utils/ObjectUtils';

/**
 * This file contains logic for derived Onyx keys. The idea behind derived keys is that if there is a common computation
 * that we're doing in many places across the app to derive some value from multiple Onyx values, we can move that
 * computation into this file, run it only once, and then share it across the app by storing the result of that computation in Onyx.
 *
 * The primary purpose is to optimize performance by reducing redundant computations. More info can be found in the README.
 */
import Onyx from 'react-native-onyx';
import OnyxKeys from 'react-native-onyx/dist/OnyxKeys';
import OnyxUtils from 'react-native-onyx/dist/OnyxUtils';

import type {DerivedValueContext} from './types';

import ONYX_DERIVED_VALUES from './ONYX_DERIVED_VALUES';
import {setDerivedValue} from './utils';

/**
 * Diff a collection dependency's current value against the baseline snapshot from the previous flush.
 * Onyx's structural sharing keeps unchanged members reference-equal, so a shallow reference scan
 * yields exactly the changed members (added, updated, or removed).
 */
function diffCollectionSourceValue(baseline: unknown, current: unknown): Record<string, unknown> {
    const changed: Record<string, unknown> = {};
    const baselineCollection = (baseline ?? {}) as Record<string, unknown>;
    const currentCollection = (current ?? {}) as Record<string, unknown>;

    for (const memberKey of Object.keys(currentCollection)) {
        if (currentCollection[memberKey] !== baselineCollection[memberKey]) {
            changed[memberKey] = currentCollection[memberKey];
        }
    }
    for (const memberKey of Object.keys(baselineCollection)) {
        if (!(memberKey in currentCollection)) {
            changed[memberKey] = undefined;
        }
    }

    return changed;
}

/**
 * Initialize all Onyx derived values, store them in Onyx, and setup listeners to update them when dependencies change.
 * Using connectWithoutView in this function since this is only executed once while initializing the App.
 */
function init() {
    for (const [key, {compute, dependencies}] of ObjectUtils.typedEntries(ONYX_DERIVED_VALUES)) {
        let areAllConnectionsSet = false;
        let connectionsEstablishedCount = 0;
        const totalConnections = dependencies.length;
        const connectionInitializedFlags = new Array(totalConnections).fill(false);

        // Create an array to hold the current values for each dependency.
        // We cast its type to match the tuple expected by config.compute.
        const dependencyValues = new Array(totalConnections) as Parameters<typeof compute>[0];

        OnyxUtils.get(key).then((storedDerivedValue) => {
            let derivedValue = storedDerivedValue;
            if (derivedValue) {
                Log.info(`Derived value for ${key} restored from disk`);
            }

            const setDependencyValue = <Index extends number>(i: Index, value: Parameters<typeof compute>[0][Index]) => {
                dependencyValues[i] = value;
            };
            const checkAndMarkConnectionInitialized = (index: number) => {
                if (connectionInitializedFlags.at(index)) {
                    return;
                }

                connectionInitializedFlags[index] = true;
                connectionsEstablishedCount++;
                if (connectionsEstablishedCount === totalConnections) {
                    areAllConnectionsSet = true;
                    Log.info(`[OnyxDerived] All connections initialized for key: ${key}`);
                }
            };

            // Create context once outside the function, swap values inline to avoid overhead of creating new objects frequently
            const context: DerivedValueContext<typeof key, typeof dependencies> = {
                currentValue: undefined,
                sourceValues: undefined,
            };

            // Coalesce all per-dependency triggers for this derived value into a single compute per macrotask.
            // Onyx delivers one logical write as separate per-key broadcasts spread across microtasks; scheduling
            // the flush with setTimeout(0) collapses all of those into one compute.
            const pendingDependencyIndexes = new Set<number>();
            const dependencyBaselines = new Array(totalConnections);
            let flushScheduled = false;
            let hasComputedOnce = false;

            const flush = () => {
                flushScheduled = false;

                // Before all connections are established, don't write to Onyx.
                // This prevents overwriting a valid disk-cached value with empty defaults,
                // and avoids N-1 unnecessary Onyx writes during initialization.
                // dependencyValues have already accumulated via setDependencyValue so data is retained.
                if (!areAllConnectionsSet) {
                    Log.info(`[OnyxDerived] not all connections set for ${key}, deferring Onyx write`);
                    pendingDependencyIndexes.clear();
                    return;
                }

                context.currentValue = derivedValue;

                if (!hasComputedOnce) {
                    // On the first compute there are no baselines to diff against, so run a full compute.
                    context.sourceValues = undefined;
                } else {
                    // Rebuild sourceValues ourselves instead of relying on Onyx's per-broadcast sourceValue.
                    // For collection dependencies we diff against the previous flush's baseline; non-collection
                    // dependencies pass their whole value.
                    const sourceValues: Record<string, unknown> = {};
                    for (const index of pendingDependencyIndexes) {
                        const dependencyOnyxKey = dependencies[index];
                        const currentDependencyValue = dependencyValues[index];
                        if (OnyxKeys.isCollectionKey(dependencyOnyxKey)) {
                            sourceValues[dependencyOnyxKey] = diffCollectionSourceValue(dependencyBaselines[index], currentDependencyValue);
                        } else {
                            sourceValues[dependencyOnyxKey] = currentDependencyValue;
                        }
                    }
                    context.sourceValues = sourceValues as unknown as typeof context.sourceValues;
                }

                const spanId = `${CONST.TELEMETRY.SPAN_ONYX_DERIVED_COMPUTE}_${key}`;
                startSpan(spanId, {
                    name: CONST.TELEMETRY.SPAN_ONYX_DERIVED_COMPUTE,
                    op: CONST.TELEMETRY.SPAN_ONYX_DERIVED_COMPUTE,
                    parentSpan: getSpan(CONST.TELEMETRY.SPAN_APP_STARTUP),
                    attributes: {derivedKey: key},
                });

                try {
                    // @ts-expect-error TypeScript can't confirm the shape of dependencyValues matches the compute function's parameters
                    const newDerivedValue = compute(dependencyValues, context);
                    Log.info(`[OnyxDerived] updating value for ${key} in Onyx`);
                    derivedValue = newDerivedValue;
                    setDerivedValue(key, derivedValue);
                } finally {
                    endSpan(spanId);
                }

                // Snapshot the current collection values as baselines for the next flush's diff.
                for (let i = 0; i < totalConnections; i++) {
                    if (OnyxKeys.isCollectionKey(dependencies[i])) {
                        dependencyBaselines[i] = dependencyValues[i];
                    }
                }
                hasComputedOnce = true;
                pendingDependencyIndexes.clear();
            };

            const recomputeDerivedValue = (triggeredByIndex: number) => {
                // If this recompute was triggered by a connection callback, check if it initializes the connection
                if (!areAllConnectionsSet) {
                    checkAndMarkConnectionInitialized(triggeredByIndex);
                }

                // Add the triggering dependency to the pending set and schedule a single flush per macrotask.
                pendingDependencyIndexes.add(triggeredByIndex);
                if (flushScheduled) {
                    return;
                }
                flushScheduled = true;
                setTimeout(flush, 0);
            };

            for (let i = 0; i < dependencies.length; i++) {
                const dependencyIndex = i;
                const dependencyOnyxKey = dependencies[dependencyIndex];

                if (OnyxKeys.isCollectionKey(dependencyOnyxKey)) {
                    Onyx.connectWithoutView({
                        key: dependencyOnyxKey,
                        waitForCollectionCallback: true,
                        callback: (value, collectionKey) => {
                            Log.info(`[OnyxDerived] dependency ${collectionKey} for derived key ${key} changed, recomputing`);
                            setDependencyValue(dependencyIndex, value as Parameters<typeof compute>[0][typeof dependencyIndex]);
                            recomputeDerivedValue(dependencyIndex);
                        },
                    });
                } else if (dependencyOnyxKey === ONYXKEYS.NVP_PREFERRED_LOCALE) {
                    // Special case for locale, we want to recompute derived values when the locale change actually loads.
                    Onyx.connectWithoutView({
                        key: ONYXKEYS.RAM_ONLY_ARE_TRANSLATIONS_LOADING,
                        callback: (value) => {
                            if (value ?? true) {
                                Log.info(`[OnyxDerived] translations are still loading, not recomputing derived value for ${key}`);
                                return;
                            }
                            Log.info(`[OnyxDerived] translations loaded, recomputing derived value for ${key}`);
                            const localeValue = IntlStore.getCurrentLocale();
                            if (!localeValue) {
                                Log.info(`[OnyxDerived] No locale found for derived key ${key}, skipping recompute`);
                                return;
                            }
                            Log.info(`[OnyxDerived] dependency ${dependencyOnyxKey} for derived key ${key} changed, recomputing`);
                            setDependencyValue(dependencyIndex, localeValue as Parameters<typeof compute>[0][typeof dependencyIndex]);
                            recomputeDerivedValue(dependencyIndex);
                        },
                    });
                } else {
                    Onyx.connectWithoutView({
                        key: dependencyOnyxKey,
                        callback: (value) => {
                            Log.info(`[OnyxDerived] dependency ${dependencyOnyxKey} for derived key ${key} changed, recomputing`);
                            setDependencyValue(dependencyIndex, value as Parameters<typeof compute>[0][typeof dependencyIndex]);
                            recomputeDerivedValue(dependencyIndex);
                        },
                    });
                }
            }
        });
    }
}

export default init;
