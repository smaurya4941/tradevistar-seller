package com.tradevistar.seller.sms

import android.app.Activity
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.os.Build
import android.os.Bundle
import androidx.core.content.ContextCompat
import com.facebook.react.bridge.ActivityEventListener
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.WritableMap
import com.facebook.react.modules.core.DeviceEventManagerModule
import com.google.android.gms.auth.api.phone.SmsRetriever
import com.google.android.gms.common.api.CommonStatusCodes
import com.google.android.gms.common.api.Status

/**
 * One-tap OTP autofill with the SMS User Consent API.
 *
 * When an SMS containing a code arrives within five minutes of `start()`, Google Play services
 * asks the seller whether TradeVistar may read that one message. Nothing is read without that tap,
 * and no SMS permission is requested. The SMS Retriever API is deliberately not used: it needs an
 * app hash inside the message, which DLT-registered SMS templates in India cannot carry.
 *
 * Events (DeviceEventEmitter "TVSmsConsent"): { type: "code", code } | { type: "denied" } |
 * { type: "timeout" } | { type: "error", message }.
 */
class SmsConsentModule(private val context: ReactApplicationContext) :
  ReactContextBaseJavaModule(context), ActivityEventListener {

  private var receiver: BroadcastReceiver? = null

  init {
    context.addActivityEventListener(this)
  }

  override fun getName(): String = NAME

  @ReactMethod
  fun start(promise: Promise) {
    stopListening()
    SmsRetriever.getClient(context)
      .startSmsUserConsent(null)
      .addOnSuccessListener {
        listen()
        promise.resolve(true)
      }
      .addOnFailureListener { error ->
        // No Play services, or an old version: the seller types or pastes the code instead.
        emit("error", error.message)
        promise.resolve(false)
      }
  }

  @ReactMethod
  fun stop() {
    stopListening()
  }

  // Required by NativeEventEmitter.
  @ReactMethod
  fun addListener(@Suppress("UNUSED_PARAMETER") eventName: String) = Unit

  @ReactMethod
  fun removeListeners(@Suppress("UNUSED_PARAMETER") count: Double) = Unit

  override fun invalidate() {
    stopListening()
    context.removeActivityEventListener(this)
    super.invalidate()
  }

  private fun listen() {
    val broadcastReceiver = object : BroadcastReceiver() {
      override fun onReceive(receiverContext: Context?, intent: Intent?) {
        if (intent?.action != SmsRetriever.SMS_RETRIEVED_ACTION) return
        val extras = intent.extras ?: return
        when (parcelable(extras, SmsRetriever.EXTRA_STATUS, Status::class.java)?.statusCode) {
          CommonStatusCodes.SUCCESS ->
            showConsent(parcelable(extras, SmsRetriever.EXTRA_CONSENT_INTENT, Intent::class.java))
          CommonStatusCodes.TIMEOUT -> {
            stopListening()
            emit("timeout", null)
          }
        }
      }
    }
    // Only Google Play services (holding SEND_PERMISSION) can deliver this broadcast.
    ContextCompat.registerReceiver(
      context,
      broadcastReceiver,
      IntentFilter(SmsRetriever.SMS_RETRIEVED_ACTION),
      SmsRetriever.SEND_PERMISSION,
      null,
      ContextCompat.RECEIVER_EXPORTED,
    )
    receiver = broadcastReceiver
  }

  private fun showConsent(consent: Intent?) {
    val activity = context.currentActivity
    if (consent == null || activity == null) return
    // Guard against intent redirection: launch only Play services' own consent screen, and never
    // pass on URI permission grants.
    val target = consent.resolveActivity(activity.packageManager)
    val grantFlags = Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_GRANT_WRITE_URI_PERMISSION
    if (target?.packageName != GMS_PACKAGE || (consent.flags and grantFlags) != 0) {
      emit("error", "Unexpected consent intent")
      return
    }
    try {
      activity.startActivityForResult(consent, REQUEST_CODE)
    } catch (error: Exception) {
      emit("error", error.message)
    }
  }

  override fun onActivityResult(activity: Activity, requestCode: Int, resultCode: Int, data: Intent?) {
    if (requestCode != REQUEST_CODE) return
    stopListening()
    if (resultCode != Activity.RESULT_OK) {
      emit("denied", null)
      return
    }
    val message = data?.getStringExtra(SmsRetriever.EXTRA_SMS_MESSAGE).orEmpty()
    val code = CODE_PATTERN.find(message)?.value
    if (code == null) {
      emit("error", "No code in message")
      return
    }
    val event = Arguments.createMap()
    event.putString("type", "code")
    event.putString("code", code)
    send(event)
  }

  override fun onNewIntent(intent: Intent) = Unit

  private fun stopListening() {
    receiver?.let {
      try {
        context.unregisterReceiver(it)
      } catch (_: IllegalArgumentException) {
        // Already unregistered.
      }
    }
    receiver = null
  }

  private fun emit(type: String, message: String?) {
    val event = Arguments.createMap()
    event.putString("type", type)
    if (message != null) event.putString("message", message)
    send(event)
  }

  private fun send(event: WritableMap) {
    if (!context.hasActiveReactInstance()) return
    context
      .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
      .emit(EVENT, event)
  }

  @Suppress("UNCHECKED_CAST")
  private fun <T> parcelable(extras: Bundle, key: String, type: Class<T>): T? =
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
      extras.getParcelable(key, type)
    } else {
      @Suppress("DEPRECATION")
      extras.getParcelable<android.os.Parcelable>(key) as? T
    }

  companion object {
    const val NAME = "TVSmsConsent"
    const val EVENT = "TVSmsConsent"
    private const val REQUEST_CODE = 0x5E5
    private const val GMS_PACKAGE = "com.google.android.gms"

    /** The first standalone 6-digit number in the message. */
    private val CODE_PATTERN = Regex("(?<!\\d)\\d{6}(?!\\d)")
  }
}
