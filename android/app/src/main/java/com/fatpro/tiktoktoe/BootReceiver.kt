package com.fatpro.tiktoktoe

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import com.facebook.react.HeadlessJsTaskService

class BootReceiver : BroadcastReceiver() {

    override fun onReceive(context: Context, intent: Intent) {
        val action = intent.action
        if (action == Intent.ACTION_BOOT_COMPLETED ||
            action == "android.intent.action.QUICKBOOT_POWERON" ||
            action == Intent.ACTION_MY_PACKAGE_REPLACED
        ) {
            HeadlessJsTaskService.acquireWakeLockNow(context)

            val serviceIntent = Intent(context, StreakHeadlessService::class.java).apply {
                putExtra("source", "BOOT")
                putExtra("triggerTime", System.currentTimeMillis())
            }

            context.startService(serviceIntent)
        }
    }
}
