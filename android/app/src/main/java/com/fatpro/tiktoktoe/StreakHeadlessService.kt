package com.fatpro.tiktoktoe

import android.content.Intent
import com.facebook.react.HeadlessJsTaskService
import com.facebook.react.bridge.Arguments
import com.facebook.react.jstasks.HeadlessJsTaskConfig

class StreakHeadlessService : HeadlessJsTaskService() {

    override fun getTaskConfig(intent: Intent?): HeadlessJsTaskConfig? {
        val extras = intent?.extras
        val map = if (extras != null) Arguments.fromBundle(extras) else Arguments.createMap()
        return HeadlessJsTaskConfig(
            "TikTokStreakHeadlessTask",
            map,
            120000, // 2 minutes timeout
            true // allowedInForeground
        )
    }
}
