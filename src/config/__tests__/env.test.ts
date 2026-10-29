type EnvModule = typeof import('../env');

/** Loads `env.ts` fresh against a pretend react-native-config file. */
function loadEnv(values: Record<string, string | undefined>): EnvModule {
  let loaded!: EnvModule;
  jest.isolateModules(() => {
    jest.doMock('react-native-config', () => ({
      __esModule: true,
      default: values,
    }));
    loaded = require('../env');
  });
  return loaded;
}

describe('env', () => {
  it('reads and normalises the flavor values', () => {
    const { env } = loadEnv({
      APP_ENV: 'staging',
      API_BASE_URL: 'https://api.example.com/',
      SOCKET_URL: 'https://socket.example.com//',
      WEB_URL: 'https://seller.example.com',
      SENTRY_DSN: ' https://key@sentry.io/1 ',
      SUPPORT_EMAIL: 'help@example.com',
      MIN_SUPPORTED_VERSION: '1.2.0',
      LATEST_VERSION: '1.3.0',
      PLAY_STORE_URL: 'https://play.google.com/store/apps/details?id=x',
    });

    expect(env.appEnv).toBe('staging');
    expect(env.apiBaseUrl).toBe('https://api.example.com');
    expect(env.socketUrl).toBe('https://socket.example.com');
    expect(env.webUrl).toBe('https://seller.example.com');
    expect(env.sentryDsn).toBe('https://key@sentry.io/1');
    expect(env.supportEmail).toBe('help@example.com');
    expect(env.fallbackConfig).toEqual({
      minSupportedVersion: '1.2.0',
      latestVersion: '1.3.0',
      updateUrl: 'https://play.google.com/store/apps/details?id=x',
    });
    expect(env.diagnosticsEnabled).toBe(true);
    expect(env.isProduction).toBe(false);
  });

  it('falls back to the emulator host and the seller portal', () => {
    const { env } = loadEnv({});

    expect(env.apiBaseUrl).toBe('http://10.0.2.2:4000');
    expect(env.socketUrl).toBe('http://10.0.2.2:4000');
    expect(env.webUrl).toBe('https://seller.tradevistar.com');
    expect(env.appEnv).toBe('development');
    expect(env.sentryDsn).toBeNull();
    expect(env.fallbackConfig.minSupportedVersion).toBe('1.0.0');
    expect(env.fallbackConfig.updateUrl).toBeNull();
  });

  it('derives the legal and help links from the web origin unless overridden', () => {
    const base = loadEnv({ WEB_URL: 'https://seller.example.com' }).env;
    expect(base.termsUrl).toBe('https://seller.example.com/info/terms-of-use');
    expect(base.privacyUrl).toBe(
      'https://seller.example.com/info/privacy-policy',
    );
    expect(base.helpUrl).toBe('https://seller.example.com/info/help-support');

    const custom = loadEnv({ TERMS_URL: 'https://legal.example.com/t' }).env;
    expect(custom.termsUrl).toBe('https://legal.example.com/t');
  });

  it('turns production on and hides diagnostics', () => {
    const { env } = loadEnv({ APP_ENV: 'production' });
    expect(env.isProduction).toBe(true);
    expect(env.diagnosticsEnabled).toBe(false);
  });

  it('ignores an unknown APP_ENV', () => {
    expect(loadEnv({ APP_ENV: 'qa' }).env.appEnv).toBe('development');
  });

  describe('analytics default', () => {
    it('is off in development and on elsewhere', () => {
      expect(loadEnv({ APP_ENV: 'development' }).env.analyticsEnabled).toBe(
        false,
      );
      expect(loadEnv({ APP_ENV: 'staging' }).env.analyticsEnabled).toBe(true);
      expect(loadEnv({ APP_ENV: 'production' }).env.analyticsEnabled).toBe(
        true,
      );
    });

    it('obeys an explicit ANALYTICS_ENABLED', () => {
      expect(
        loadEnv({ APP_ENV: 'production', ANALYTICS_ENABLED: 'false' }).env
          .analyticsEnabled,
      ).toBe(false);
      expect(
        loadEnv({ APP_ENV: 'development', ANALYTICS_ENABLED: 'TRUE' }).env
          .analyticsEnabled,
      ).toBe(true);
    });
  });

  it('reports maps as enabled only with a key', () => {
    expect(loadEnv({}).env.mapsEnabled).toBe(false);
    expect(loadEnv({ GOOGLE_MAPS_API_KEY: 'abc' }).env.mapsEnabled).toBe(true);
  });

  describe('bad values fail at startup', () => {
    it.each([
      ['API_BASE_URL', 'api.example.com'],
      ['API_BASE_URL', 'ftp://api.example.com'],
      ['API_BASE_URL', 'http://'],
      ['SOCKET_URL', 'localhost:4000'],
      ['WEB_URL', 'seller.example.com'],
    ])('rejects %s=%s', (name, value) => {
      expect(() => loadEnv({ [name]: value })).toThrow(
        new RegExp(`${name} must be an absolute http\\(s\\) URL`),
      );
    });

    it('rejects a malformed optional URL', () => {
      expect(() => loadEnv({ TERMS_URL: 'not a url' })).toThrow(/TERMS_URL/);
      expect(() => loadEnv({ PLAY_STORE_URL: 'play.google.com' })).toThrow(
        /PLAY_STORE_URL/,
      );
    });
  });

  it('treats blank values as missing', () => {
    const { env } = loadEnv({ API_BASE_URL: '   ', SUPPORT_EMAIL: '' });
    expect(env.apiBaseUrl).toBe('http://10.0.2.2:4000');
    expect(env.supportEmail).toBe('support@tradevistar.com');
  });
});
