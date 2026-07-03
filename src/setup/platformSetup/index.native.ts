import DeviceInfo from 'react-native-device-info';

import Log from '@libs/Log';

import CONFIG from '@src/CONFIG';

import pkg from '../../../package.json';

export default function () {
    const nativeVersion = DeviceInfo.getVersion();
    if (CONFIG.IS_HYBRID_APP && !pkg.version.startsWith(nativeVersion)) {
        Log.alert('JS bundle version does not match native binary version', {jsVersion: pkg.version, nativeVersion});
    }
}
