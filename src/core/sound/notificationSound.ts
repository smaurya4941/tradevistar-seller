/**
 * The in-app notification sound: the audio an admin uploaded for new-notification alerts, kept on
 * the device and played when a notification arrives while the app is open.
 *
 * The server sends the sound as a `data:` URI of at most 1 MB (or a link). It is saved once per
 * version in the app's private cache, so playing is instant and needs no network. A new version
 * replaces the old file. Playing never throws into the app: a missing or broken sound is simply
 * silent. Notifications that arrive while the app is closed use the system notification
 * channel's own sound, which the phone controls and an admin upload cannot change.
 */
import {
  parseSoundSource,
  type NotificationSoundSetting,
} from '@tradevistar/seller-api';
import ReactNativeBlobUtil from 'react-native-blob-util';
import Sound from 'react-native-nitro-sound';
import { logger } from '@/core/logger';
import { isPhoneSilent } from '@/core/native/ringerMode';

const { fs } = ReactNativeBlobUtil;

/** Two alerts closer together than this make one sound, not a stutter. */
export const MIN_GAP_MS = 1_500;

const directory = () => `${fs.dirs.CacheDir}/notification-sound`;

const pathFor = (version: number, extension: string) =>
  `${directory()}/v${version}.${extension}`;

/** Every saved sound other than `keep` is removed, so old versions never pile up. */
async function removeStale(keep: string): Promise<void> {
  try {
    const names = await fs.ls(directory());
    await Promise.all(
      names
        .map(name => `${directory()}/${name}`)
        .filter(path => path !== keep)
        .map(path => fs.unlink(path).catch(() => undefined)),
    );
  } catch {
    // Nothing saved yet, or the folder is gone: there is nothing to clean.
  }
}

/**
 * Makes the setting's sound playable and returns its local file path, or null when there is no
 * usable sound. Reuses the saved file for this version.
 */
export async function prepareNotificationSound(
  setting: NotificationSoundSetting,
): Promise<string | null> {
  const source = parseSoundSource(setting.source);
  if (!source) return null;
  const extension = source.kind === 'data' ? source.extension : 'mp3';
  const path = pathFor(setting.version, extension);
  try {
    if (await fs.exists(path)) return path;
    await fs.mkdir(directory()).catch(() => undefined);
    if (source.kind === 'data') {
      await fs.writeFile(path, source.base64, 'base64');
    } else {
      await ReactNativeBlobUtil.config({ path }).fetch('GET', source.url);
    }
    await removeStale(path);
    return path;
  } catch (error) {
    logger.info('[sound] notification sound could not be prepared', error);
    await fs.unlink(path).catch(() => undefined);
    return null;
  }
}

let lastPlayedAt = 0;

/** Plays the saved sound once. Resolves whether or not it played; never rejects. */
export async function playNotificationSound(
  path: string,
  now: number = Date.now(),
): Promise<boolean> {
  if (now - lastPlayedAt < MIN_GAP_MS) return false;
  // The media stream ignores the ringer switch, so honour the phone's silent mode here.
  if (await isPhoneSilent()) return false;
  lastPlayedAt = now;
  try {
    // A sound still playing is cut off rather than layered.
    await Sound.stopPlayer().catch(() => undefined);
    Sound.removePlaybackEndListener();
    Sound.addPlaybackEndListener(() => {
      Sound.removePlaybackEndListener();
      Sound.stopPlayer().catch(() => undefined);
    });
    await Sound.setVolume(1).catch(() => undefined);
    await Sound.startPlayer(
      path.startsWith('file://') ? path : `file://${path}`,
    );
    return true;
  } catch (error) {
    logger.info('[sound] notification sound did not play', error);
    return false;
  }
}

/** For tests: forget when the last sound played. */
export function resetSoundThrottle(): void {
  lastPlayedAt = 0;
}

/** Removes every saved sound (sign-out of the last seller, or "clear data"). */
export async function clearNotificationSounds(): Promise<void> {
  await fs.unlink(directory()).catch(() => undefined);
}
