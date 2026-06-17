// Explanation: Different Mapbox libraries are required for web and native mobile platforms.
// This is why we have separate components for web and native to handle the specific implementations.
// For the web version, we use the Mapbox Web library called react-map-gl, while for the native mobile version,
// we utilize a different Mapbox library @rnmapbox/maps tailored for mobile development.
import {useFocusEffect} from '@react-navigation/native';
import 'mapbox-gl/dist/mapbox-gl.css';
import React, {useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState} from 'react';
import type {MapRef, ViewState} from 'react-map-gl/mapbox';
import Map, {Marker} from 'react-map-gl/mapbox';
import {View} from 'react-native';
import type {LayoutChangeEvent} from 'react-native';
import Button from '@components/Button';
import Image from '@components/Image';
import ImageSVG from '@components/ImageSVG';
import {PressableWithoutFeedback} from '@components/Pressable';
import Text from '@components/Text';
import {useMemoizedLazyExpensifyIcons} from '@hooks/useLazyAsset';
import useOnyx from '@hooks/useOnyx';
import usePrevious from '@hooks/usePrevious';
import useStyleUtils from '@hooks/useStyleUtils';
import useTheme from '@hooks/useTheme';
import useThemeStyles from '@hooks/useThemeStyles';
import DistanceRequestUtils from '@libs/DistanceRequestUtils';
import type {GeolocationErrorCallback} from '@libs/getCurrentPosition/getCurrentPosition.types';
import {GeolocationErrorCode} from '@libs/getCurrentPosition/getCurrentPosition.types';
import colors from '@styles/theme/colors';
import {clearUserLocation, setUserLocation} from '@userActions/UserLocation';
import CONST from '@src/CONST';
import useLocalize from '@src/hooks/useLocalize';
import useNetwork from '@src/hooks/useNetwork';
import getCurrentPosition from '@src/libs/getCurrentPosition';
import ONYXKEYS from '@src/ONYXKEYS';
import Direction from './Direction';
import './mapbox.css';
import type {Coordinate, MapViewProps, WayPoint} from './MapViewTypes';
import PendingMapView from './PendingMapView';
import responder from './responder';
import useDistanceUnit from './useDistanceUnit';
import utils from './utils';

// The Mapbox Static Images API caps the requested image dimensions at 1280px per side.
const STATIC_MAP_MAX_DIMENSION = 1280;
const STATIC_MAP_ROUTE_COLOR = colors.green400.replace('#', '');

/**
 * Encodes a list of [longitude, latitude] coordinates into an encoded polyline (precision 5),
 * so the route can be drawn on a Mapbox Static Images API request without instantiating a WebGL map.
 */
function encodePolyline(coordinates: Coordinate[]): string {
    let lastLat = 0;
    let lastLng = 0;
    let result = '';

    const encodeValue = (value: number) => {
        // eslint-disable-next-line no-bitwise
        let encoded = value < 0 ? ~(value << 1) : value << 1;
        let chunk = '';
        while (encoded >= 0x20) {
            // eslint-disable-next-line no-bitwise
            chunk += String.fromCharCode((0x20 | (encoded & 0x1f)) + 63);
            // eslint-disable-next-line no-bitwise
            encoded >>= 5;
        }
        chunk += String.fromCharCode(encoded + 63);
        return chunk;
    };

    coordinates.forEach(([longitude, latitude]) => {
        const lat = Math.round(latitude * 1e5);
        const lng = Math.round(longitude * 1e5);
        result += encodeValue(lat - lastLat);
        result += encodeValue(lng - lastLng);
        lastLat = lat;
        lastLng = lng;
    });

    return result;
}

/**
 * Builds a Mapbox Static Images API URL for a non-interactive map preview. Static images consume zero WebGL
 * contexts, so any number of distance previews can coexist on a page without exceeding the browser's limit.
 */
function getStaticMapImageURL(
    styleURL: string | undefined,
    accessToken: string,
    waypoints: WayPoint[] | undefined,
    directionCoordinates: Coordinate[] | undefined,
    width: number,
    height: number,
    padding?: number,
): string | undefined {
    if (!styleURL || !accessToken || width <= 0 || height <= 0) {
        return undefined;
    }

    const overlays: string[] = [];
    if (directionCoordinates && directionCoordinates.length >= 2) {
        overlays.push(`path-4+${STATIC_MAP_ROUTE_COLOR}(${encodeURIComponent(encodePolyline(directionCoordinates))})`);
    }
    waypoints?.forEach(({coordinate}) => {
        overlays.push(`pin-s+${STATIC_MAP_ROUTE_COLOR}(${coordinate[0]},${coordinate[1]})`);
    });

    if (overlays.length === 0) {
        return undefined;
    }

    const styleId = styleURL.replace('mapbox://styles/', '');
    const imageWidth = Math.min(STATIC_MAP_MAX_DIMENSION, Math.round(width));
    const imageHeight = Math.min(STATIC_MAP_MAX_DIMENSION, Math.round(height));

    // The Static Images API rejects `padding` values that are larger than half the image, so clamp it for small previews.
    const maxPadding = Math.max(0, Math.floor(Math.min(imageWidth, imageHeight) / 2) - 1);
    const effectivePadding = Math.min(padding ?? 0, maxPadding);
    const paddingParam = effectivePadding > 0 ? `&padding=${effectivePadding}` : '';

    return `https://api.mapbox.com/styles/v1/${styleId}/static/${overlays.join(',')}/auto/${imageWidth}x${imageHeight}@2x?access_token=${accessToken}${paddingParam}`;
}

function MapViewImpl({
    style,
    styleURL,
    waypoints,
    mapPadding,
    accessToken,
    directionCoordinates: directionCoordinatesProp,
    initialState = {location: CONST.MAPBOX.DEFAULT_COORDINATE, zoom: CONST.MAPBOX.DEFAULT_ZOOM},
    interactive = true,
    distanceInMeters,
    unit,
    ref,
    shouldDisplayCurrentLocation = true,
}: MapViewProps) {
    const directionCoordinates = !directionCoordinatesProp || utils.isSingleSegmentRoute(directionCoordinatesProp) ? directionCoordinatesProp : directionCoordinatesProp.flat();

    const [userLocation] = useOnyx(ONYXKEYS.USER_LOCATION);

    const {isOffline} = useNetwork();
    const {translate} = useLocalize();
    const {distanceUnit, toggleDistanceUnit} = useDistanceUnit(unit);

    const theme = useTheme();
    const styles = useThemeStyles();
    const StyleUtils = useStyleUtils();
    const expensifyIcons = useMemoizedLazyExpensifyIcons(['Crosshair', 'MapCurrentLocation']);

    const [mapRef, setMapRef] = useState<MapRef | null>(null);
    const initialLocation = useMemo(() => ({longitude: initialState.location[0], latitude: initialState.location[1]}), [initialState]);
    const currentPosition = userLocation ?? initialLocation;
    const prevUserPosition = usePrevious(currentPosition);
    const [userInteractedWithMap, setUserInteractedWithMap] = useState(false);
    const [shouldResetBoundaries, setShouldResetBoundaries] = useState<boolean>(false);
    const [staticMapSize, setStaticMapSize] = useState({width: 0, height: 0});
    const setRef = useCallback((newRef: MapRef | null) => setMapRef(newRef), []);
    const shouldInitializeCurrentPosition = useRef(true);

    // Determines if map can be panned to user's detected
    // location without bothering the user. It will return
    // false if user has already started dragging the map or
    // if there are one or more waypoints present.
    const shouldPanMapToCurrentPosition = useCallback(
        () => !userInteractedWithMap && shouldDisplayCurrentLocation && (!waypoints || waypoints.length === 0),
        [userInteractedWithMap, waypoints, shouldDisplayCurrentLocation],
    );

    const setCurrentPositionToInitialState: GeolocationErrorCallback = useCallback(
        (error) => {
            if (error?.code !== GeolocationErrorCode.PERMISSION_DENIED || !initialLocation) {
                return;
            }
            clearUserLocation();
        },
        [initialLocation],
    );

    useFocusEffect(
        useCallback(() => {
            if (isOffline) {
                return;
            }

            if (!shouldInitializeCurrentPosition.current) {
                return;
            }

            shouldInitializeCurrentPosition.current = false;

            if (!shouldPanMapToCurrentPosition()) {
                setCurrentPositionToInitialState();
                return;
            }

            getCurrentPosition((params) => {
                const currentCoords = {longitude: params.coords.longitude, latitude: params.coords.latitude};
                setUserLocation(currentCoords);
            }, setCurrentPositionToInitialState);
        }, [isOffline, shouldPanMapToCurrentPosition, setCurrentPositionToInitialState]),
    );

    useEffect(() => {
        if (!currentPosition || !mapRef) {
            return;
        }

        if (!shouldPanMapToCurrentPosition()) {
            return;
        }

        // Avoid animating the navigation to the same location
        const shouldAnimate = prevUserPosition.longitude !== currentPosition.longitude || prevUserPosition.latitude !== currentPosition.latitude;

        mapRef.flyTo({
            center: [currentPosition.longitude, currentPosition.latitude],
            zoom: CONST.MAPBOX.DEFAULT_ZOOM,
            animate: shouldAnimate,
        });
    }, [currentPosition, mapRef, prevUserPosition.longitude, prevUserPosition.latitude, shouldPanMapToCurrentPosition]);

    const resetBoundaries = useCallback(() => {
        if (!waypoints || waypoints.length === 0) {
            return;
        }

        if (!mapRef) {
            return;
        }

        if (waypoints.length === 1) {
            mapRef.flyTo({
                center: waypoints.at(0)?.coordinate,
                zoom: CONST.MAPBOX.SINGLE_MARKER_ZOOM,
            });
            return;
        }

        const map = mapRef.getMap();

        const {northEast, southWest} = utils.getBounds(
            waypoints.map((waypoint) => waypoint.coordinate),
            directionCoordinates,
        );
        map.fitBounds([northEast, southWest], {padding: mapPadding});
    }, [waypoints, mapRef, mapPadding, directionCoordinates]);

    useEffect(resetBoundaries, [resetBoundaries]);

    useEffect(() => {
        if (!shouldResetBoundaries) {
            return;
        }

        resetBoundaries();
        setShouldResetBoundaries(false);
        // eslint-disable-next-line react-hooks/exhaustive-deps -- this effect only needs to run when the boundaries reset is forced
    }, [shouldResetBoundaries]);

    useEffect(() => {
        if (!mapRef) {
            return;
        }

        const resizeObserver = new ResizeObserver(() => {
            mapRef.resize();
            setShouldResetBoundaries(true);
        });
        resizeObserver.observe(mapRef.getContainer());

        return () => {
            resizeObserver?.disconnect();
        };
    }, [mapRef]);

    useImperativeHandle(
        ref,
        () => ({
            flyTo: (location: [number, number], zoomLevel: number = CONST.MAPBOX.DEFAULT_ZOOM, animationDuration?: number) =>
                mapRef?.flyTo({
                    center: location,
                    zoom: zoomLevel,
                    duration: animationDuration,
                }),
            fitBounds: (northEast: [number, number], southWest: [number, number]) => mapRef?.fitBounds([northEast, southWest]),
        }),
        [mapRef],
    );

    const centerMap = useCallback(() => {
        if (!mapRef) {
            return;
        }
        const waypointCoordinates = waypoints?.map((waypoint) => waypoint.coordinate) ?? [];
        if (waypointCoordinates.length > 1 || (directionCoordinates ?? []).length > 1) {
            const {northEast, southWest} = utils.getBounds(waypoints?.map((waypoint) => waypoint.coordinate) ?? [], directionCoordinates);
            const map = mapRef?.getMap();
            map?.fitBounds([southWest, northEast], {padding: mapPadding, animate: true, duration: CONST.MAPBOX.ANIMATION_DURATION_ON_CENTER_ME});
            return;
        }

        mapRef.flyTo({
            center: [currentPosition?.longitude ?? 0, currentPosition?.latitude ?? 0],
            zoom: CONST.MAPBOX.SINGLE_MARKER_ZOOM,
            bearing: 0,
            animate: true,
            duration: CONST.MAPBOX.ANIMATION_DURATION_ON_CENTER_ME,
        });
    }, [directionCoordinates, currentPosition?.longitude, currentPosition?.latitude, mapRef, waypoints, mapPadding]);

    const initialViewState: Partial<ViewState> | undefined = useMemo(() => {
        if (!interactive) {
            if (!waypoints) {
                return undefined;
            }
            const {northEast, southWest} = utils.getBounds(
                waypoints.map((waypoint) => waypoint.coordinate),
                directionCoordinates,
            );
            return {
                zoom: initialState.zoom,
                bounds: [northEast, southWest],
            };
        }
        return {
            longitude: currentPosition?.longitude,
            latitude: currentPosition?.latitude,
            zoom: initialState.zoom,
        };
    }, [waypoints, directionCoordinates, interactive, currentPosition?.longitude, currentPosition?.latitude, initialState.zoom]);

    const distanceSymbolCoordinate = useMemo(() => {
        if (!directionCoordinates?.length || !waypoints?.length) {
            return;
        }
        const {northEast, southWest} = utils.getBounds(
            waypoints.map((waypoint) => waypoint.coordinate),
            directionCoordinates,
        );
        const boundsCenter = utils.getBoundsCenter({northEast, southWest});

        return utils.findClosestCoordinateOnLineFromCenter(boundsCenter, directionCoordinates);
    }, [waypoints, directionCoordinates]);

    const onStaticMapLayout = useCallback((event: LayoutChangeEvent) => {
        const {width, height} = event.nativeEvent.layout;
        setStaticMapSize((prevSize) => (prevSize.width === width && prevSize.height === height ? prevSize : {width, height}));
    }, []);

    // Non-interactive previews never need to be panned or zoomed, so render a static map image instead of a live
    // WebGL map. This avoids exhausting the browser's per-page WebGL context limit when many distance previews
    // are visible at once (e.g. on /home).
    const staticMapImageURL = useMemo(
        () => (interactive ? undefined : getStaticMapImageURL(styleURL, accessToken, waypoints, directionCoordinates, staticMapSize.width, staticMapSize.height, mapPadding)),
        [interactive, styleURL, accessToken, waypoints, directionCoordinates, staticMapSize.width, staticMapSize.height, mapPadding],
    );

    if (!interactive) {
        return !isOffline && !!accessToken && !!initialViewState ? (
            <View
                style={style}
                onLayout={onStaticMapLayout}
                {...responder.panHandlers}
            >
                {!!staticMapImageURL && (
                    <Image
                        source={{uri: staticMapImageURL}}
                        style={styles.flex1}
                        isAuthTokenRequired={false}
                    />
                )}
            </View>
        ) : (
            <PendingMapView
                title={translate('distance.mapPending.title')}
                subtitle={isOffline ? translate('distance.mapPending.subtitle') : translate('distance.mapPending.onlineSubtitle')}
                style={styles.mapEditView}
            />
        );
    }

    return !isOffline && !!accessToken && !!initialViewState ? (
        <View
            style={style}
            {...responder.panHandlers}
        >
            <Map
                onDrag={() => setUserInteractedWithMap(true)}
                ref={setRef}
                mapboxAccessToken={accessToken}
                initialViewState={initialViewState}
                style={{...StyleUtils.getTextColorStyle(theme.mapAttributionText), zIndex: -1}}
                mapStyle={styleURL}
                interactive={interactive}
            >
                {interactive && shouldDisplayCurrentLocation && (
                    <Marker
                        key="Current-position"
                        longitude={currentPosition?.longitude ?? 0}
                        latitude={currentPosition?.latitude ?? 0}
                    >
                        <ImageSVG
                            src={expensifyIcons.MapCurrentLocation}
                            width={CONST.MAP_MARKER_SIZES.CURRENT_LOCATION.width}
                            height={CONST.MAP_MARKER_SIZES.CURRENT_LOCATION.height}
                        />
                    </Marker>
                )}
                {!!distanceSymbolCoordinate && !!distanceInMeters && !!distanceUnit && (
                    <Marker
                        key="distance-label"
                        longitude={distanceSymbolCoordinate.at(0) ?? 0}
                        latitude={distanceSymbolCoordinate.at(1) ?? 0}
                    >
                        <PressableWithoutFeedback
                            sentryLabel="MapView-ToggleDistanceUnit"
                            accessibilityLabel={CONST.ROLE.BUTTON}
                            role={CONST.ROLE.BUTTON}
                            onPress={toggleDistanceUnit}
                        >
                            <View style={styles.distanceLabelWrapper}>
                                <Text style={styles.distanceLabelText}> {DistanceRequestUtils.getDistanceForDisplayLabel(distanceInMeters, distanceUnit)}</Text>
                            </View>
                        </PressableWithoutFeedback>
                    </Marker>
                )}
                {waypoints?.map(({coordinate, markerComponent, id}) => {
                    const MarkerComponent = markerComponent;
                    if (
                        utils.areSameCoordinate([coordinate[0], coordinate[1]], [currentPosition?.longitude ?? 0, currentPosition?.latitude ?? 0]) &&
                        interactive &&
                        shouldDisplayCurrentLocation
                    ) {
                        return null;
                    }
                    return (
                        <Marker
                            key={id}
                            longitude={coordinate[0]}
                            latitude={coordinate[1]}
                        >
                            <MarkerComponent />
                        </Marker>
                    );
                })}
                {!!directionCoordinatesProp && <Direction coordinates={directionCoordinatesProp} />}
            </Map>
            {interactive && (
                <View style={[styles.pAbsolute, styles.p5, styles.t0, styles.r0, {zIndex: 1}]}>
                    <Button
                        onPress={centerMap}
                        iconFill={theme.icon}
                        icon={expensifyIcons.Crosshair}
                        accessibilityLabel={translate('common.center')}
                    />
                </View>
            )}
        </View>
    ) : (
        <PendingMapView
            title={translate('distance.mapPending.title')}
            subtitle={isOffline ? translate('distance.mapPending.subtitle') : translate('distance.mapPending.onlineSubtitle')}
            style={styles.mapEditView}
        />
    );
}

export default MapViewImpl;
