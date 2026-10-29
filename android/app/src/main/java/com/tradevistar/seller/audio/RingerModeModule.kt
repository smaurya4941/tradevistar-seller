package com.tradevistar.seller.audio

import android.content.Context
import android.media.AudioManager
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

/**
 * Reports whether the phone is in silent or vibrate mode. The in-app notification sound plays on
 * the media stream, which ignores the ringer switch, so the app asks first and stays quiet when
 * the seller has silenced the phone.
 */
class RingerModeModule(private val context: ReactApplicationContext) :
  ReactContextBaseJavaModule(context) {

  override fun getName() = "TVRingerMode"

  /** Resolves true for silent and vibrate; false for normal, and when the mode cannot be read. */
  @ReactMethod
  fun isSilent(promise: Promise) {
    try {
      val audio = context.getSystemService(Context.AUDIO_SERVICE) as? AudioManager
      promise.resolve(audio != null && audio.ringerMode != AudioManager.RINGER_MODE_NORMAL)
    } catch (error: Exception) {
      promise.resolve(false)
    }
  }
}
