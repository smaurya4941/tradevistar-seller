package com.tradevistar.seller.security

import android.view.WindowManager
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.UiThreadUtil

/**
 * Sets FLAG_SECURE on the activity window while a sensitive screen (documents, KYC, GST, bank, security,
 * registration) is showing. The flag blocks screenshots and screen recording and blanks the
 * app's thumbnail in Recents. JS reference-counts callers, so this only ever turns it on or off.
 */
class SecureScreenModule(context: ReactApplicationContext) :
  ReactContextBaseJavaModule(context) {

  override fun getName(): String = NAME

  @ReactMethod
  fun setSecure(secure: Boolean) {
    UiThreadUtil.runOnUiThread {
      val window = reactApplicationContext.currentActivity?.window ?: return@runOnUiThread
      if (secure) {
        window.addFlags(WindowManager.LayoutParams.FLAG_SECURE)
      } else {
        window.clearFlags(WindowManager.LayoutParams.FLAG_SECURE)
      }
    }
  }

  companion object {
    const val NAME = "TVSecureScreen"
  }
}
