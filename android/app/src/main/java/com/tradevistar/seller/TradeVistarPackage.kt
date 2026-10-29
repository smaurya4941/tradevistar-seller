package com.tradevistar.seller

import com.facebook.react.ReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.uimanager.ViewManager
import com.tradevistar.seller.audio.RingerModeModule
import com.tradevistar.seller.security.SecureScreenModule
import com.tradevistar.seller.sms.SmsConsentModule

/** The app's own native modules: SMS consent autofill, the ringer mode, and secure (capture-blocked) screens. */
class TradeVistarPackage : ReactPackage {
  override fun createNativeModules(context: ReactApplicationContext): List<NativeModule> =
    listOf(SmsConsentModule(context), RingerModeModule(context), SecureScreenModule(context))

  override fun createViewManagers(context: ReactApplicationContext): List<ViewManager<*, *>> =
    emptyList()
}
