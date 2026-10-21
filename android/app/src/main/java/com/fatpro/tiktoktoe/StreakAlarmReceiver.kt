package com.fatpro.tiktoktoe

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.Build
import com.facebook.react.HeadlessJsTaskService

class StreakAlarmReceiver : BroadcastReceiver() {

    override fun onReceive(context: Context, intent: Intent) {
        val taskId = intent.getStringExtra("taskId") ?: ""

        // Acquire CPU wake lock for Headless JS initialization
        HeadlessJsTaskService.acquireWakeLockNow(context)

        val serviceIntent = Intent(context, StreakHeadlessService::class.java).apply {
            putExtra("taskId", taskId)
            putExtra("source", "ALARM")
            putExtra("triggerTime", System.currentTimeMillis())
        }

        context.startService(serviceIntent)
    }
}
