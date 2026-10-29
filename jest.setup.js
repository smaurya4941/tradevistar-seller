/* eslint-env jest */
/**
 * Native module mocks for the app's unit tests. Each library that ships an official mock uses
 * it; the rest get the smallest fake that keeps imports working.
 */
jest.mock('react-native-device-info', () => {
  const mock = require('react-native-device-info/jest/react-native-device-info-mock');
  mock.getVersion = () => '1.0.0';
  mock.getBuildNumber = () => '1';
  mock.getBundleId = () => 'com.tradevistar.seller';
  mock.getSystemVersion = () => '14';
  mock.getBrand = () => 'Google';
  mock.getModel = () => 'Pixel 7';
  return mock;
});
jest.mock('@react-native-community/netinfo', () =>
  require('@react-native-community/netinfo/jest/netinfo-mock.js'),
);

jest.mock('react-native-config', () => ({
  __esModule: true,
  default: {
    APP_ENV: 'development',
    API_BASE_URL: 'http://localhost:4000',
    SOCKET_URL: 'http://localhost:4000',
    WEB_URL: 'https://seller.tradevistar.com',
  },
}));

jest.mock('react-native-keychain', () => {
  let stored = null;
  return {
    ACCESSIBLE: {
      AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY:
        'AccessibleAfterFirstUnlockThisDeviceOnly',
    },
    STORAGE_TYPE: { AES_GCM_NO_AUTH: 'KeystoreAESGCM_NoAuth' },
    setGenericPassword: jest.fn(async (username, password) => {
      stored = { username, password, service: 'test' };
      return { service: 'test', storage: 'KeystoreAESGCM_NoAuth' };
    }),
    getGenericPassword: jest.fn(async () => stored || false),
    resetGenericPassword: jest.fn(async () => {
      stored = null;
      return true;
    }),
  };
});

jest.mock('react-native-mmkv', () => ({
  createMMKV: () => {
    const map = new Map();
    return {
      set: (key, value) => map.set(key, value),
      getString: key =>
        typeof map.get(key) === 'string' ? map.get(key) : undefined,
      getBoolean: key =>
        typeof map.get(key) === 'boolean' ? map.get(key) : undefined,
      getNumber: key =>
        typeof map.get(key) === 'number' ? map.get(key) : undefined,
      contains: key => map.has(key),
      remove: key => map.delete(key),
      getAllKeys: () => [...map.keys()],
      clearAll: () => map.clear(),
    };
  },
}));

jest.mock('@react-native-firebase/app', () => ({ getApps: jest.fn(() => []) }));
jest.mock('@react-native-firebase/analytics', () => ({
  getAnalytics: jest.fn(() => ({})),
  logEvent: jest.fn(async () => undefined),
  logScreenView: jest.fn(async () => undefined),
  setUserId: jest.fn(async () => undefined),
  setAnalyticsCollectionEnabled: jest.fn(async () => undefined),
}));
jest.mock('@sentry/react-native', () => ({
  init: jest.fn(),
  captureException: jest.fn(),
  captureMessage: jest.fn(),
  addBreadcrumb: jest.fn(),
  setUser: jest.fn(),
  withScope: jest.fn(callback => callback({ setContext: jest.fn() })),
  wrap: jest.fn(component => component),
}));

jest.mock('@d11/react-native-fast-image', () => {
  const React = require('react');
  const { View } = require('react-native');
  const FastImage = props => React.createElement(View, props);
  FastImage.preload = jest.fn();
  FastImage.clearMemoryCache = jest.fn(async () => undefined);
  FastImage.clearDiskCache = jest.fn(async () => undefined);
  FastImage.resizeMode = {
    contain: 'contain',
    cover: 'cover',
    stretch: 'stretch',
    center: 'center',
  };
  FastImage.priority = { low: 'low', normal: 'normal', high: 'high' };
  return { __esModule: true, default: FastImage };
});

// Phase 2 native modules. Each gets the smallest fake that keeps imports and calls working.
jest.mock('@notifee/react-native', () => ({
  __esModule: true,
  default: {
    createChannels: jest.fn(async () => undefined),
    displayNotification: jest.fn(async () => 'id'),
    cancelNotification: jest.fn(async () => undefined),
    cancelAllNotifications: jest.fn(async () => undefined),
    cancelDisplayedNotifications: jest.fn(async () => undefined),
    getDisplayedNotifications: jest.fn(async () => []),
    getInitialNotification: jest.fn(async () => null),
    getNotificationSettings: jest.fn(async () => ({ authorizationStatus: 1 })),
    requestPermission: jest.fn(async () => ({ authorizationStatus: 1 })),
    openNotificationSettings: jest.fn(async () => undefined),
    setBadgeCount: jest.fn(async () => undefined),
    onForegroundEvent: jest.fn(() => () => undefined),
    onBackgroundEvent: jest.fn(),
  },
  AndroidImportance: { HIGH: 4, DEFAULT: 3, LOW: 2 },
  AuthorizationStatus: { DENIED: 0, AUTHORIZED: 1, PROVISIONAL: 2 },
  EventType: { PRESS: 1, DISMISSED: 0 },
}));
jest.mock('@react-native-firebase/messaging', () => ({
  getMessaging: jest.fn(() => ({})),
  getToken: jest.fn(async () => 'token'),
  onTokenRefresh: jest.fn(() => () => undefined),
  onMessage: jest.fn(() => () => undefined),
  setBackgroundMessageHandler: jest.fn(),
}));
jest.mock('socket.io-client', () => {
  const handlers = {};
  const socket = {
    on: jest.fn((event, handler) => {
      handlers[event] = handler;
      return socket;
    }),
    connect: jest.fn(),
    disconnect: jest.fn(),
    removeAllListeners: jest.fn(),
    __handlers: handlers,
  };
  return { io: jest.fn(() => socket), __socket: socket };
});
jest.mock('react-native-blob-util', () => ({
  __esModule: true,
  default: {
    fs: {
      dirs: { CacheDir: '/cache' },
      exists: jest.fn(async () => false),
      mkdir: jest.fn(async () => undefined),
      writeFile: jest.fn(async () => undefined),
      unlink: jest.fn(async () => undefined),
      ls: jest.fn(async () => []),
    },
    config: jest.fn(() => ({ fetch: jest.fn(async () => ({})) })),
  },
}));
jest.mock('react-native-nitro-sound', () => ({
  __esModule: true,
  default: {
    startPlayer: jest.fn(async () => undefined),
    stopPlayer: jest.fn(async () => undefined),
    setVolume: jest.fn(async () => undefined),
    addPlaybackEndListener: jest.fn(),
    removePlaybackEndListener: jest.fn(),
  },
}));
jest.mock('react-native-share', () => ({
  __esModule: true,
  default: { open: jest.fn(async () => ({ success: true })) },
}));
jest.mock('react-native-svg', () => {
  const React = require('react');
  const { View } = require('react-native');
  const make = name => props =>
    React.createElement(
      View,
      { ...props, testID: props.testID ?? name },
      props.children,
    );
  return {
    __esModule: true,
    default: make('Svg'),
    Svg: make('Svg'),
    Circle: make('Circle'),
    Line: make('Line'),
    Path: make('Path'),
    Text: make('SvgText'),
  };
});

// Phase 3 native modules: documents, scanning, images, maps, location.
jest.mock('react-native-compressor', () => ({
  __esModule: true,
  Image: { compress: jest.fn(async uri => uri) },
}));
jest.mock('react-native-document-scanner-plugin', () => ({
  __esModule: true,
  default: { scanDocument: jest.fn(async () => ({ status: 'cancel', scannedImages: [] })) },
  ScanDocumentResponseStatus: { Success: 'success', Cancel: 'cancel' },
}));
jest.mock('react-native-image-crop-picker', () => ({
  __esModule: true,
  default: {
    openCamera: jest.fn(),
    openPicker: jest.fn(),
    clean: jest.fn(async () => undefined),
  },
}));
jest.mock('react-native-image-picker', () => ({
  launchCamera: jest.fn(async () => ({ didCancel: true })),
  launchImageLibrary: jest.fn(async () => ({ didCancel: true })),
}));
jest.mock('@react-native-documents/picker', () => ({
  pick: jest.fn(async () => []),
  keepLocalCopy: jest.fn(async () => []),
  isErrorWithCode: jest.fn(() => false),
  errorCodes: { OPERATION_CANCELED: 'OPERATION_CANCELED' },
  types: { pdf: 'application/pdf', images: 'image/*' },
}));
jest.mock('@react-native-community/geolocation', () => ({
  __esModule: true,
  default: {
    setRNConfiguration: jest.fn(),
    requestAuthorization: jest.fn(),
    getCurrentPosition: jest.fn(),
    watchPosition: jest.fn(() => 1),
    clearWatch: jest.fn(),
  },
}));
jest.mock('@react-native-clipboard/clipboard', () => ({
  __esModule: true,
  default: { setString: jest.fn(), getString: jest.fn(async () => '') },
}));
jest.mock('react-native-maps', () => {
  const React = require('react');
  const { View } = require('react-native');
  const MapView = props => React.createElement(View, props, props.children);
  return {
    __esModule: true,
    default: MapView,
    Marker: props => React.createElement(View, props),
    PROVIDER_GOOGLE: 'google',
  };
});
