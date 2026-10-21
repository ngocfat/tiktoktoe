package com.fatpro.tiktoktoe

import android.annotation.SuppressLint
import android.app.AlarmManager
import android.app.DownloadManager
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.Environment
import android.os.PowerManager
import android.provider.Settings
import android.media.MediaScannerConnection
import android.webkit.CookieManager
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.core.content.ContextCompat
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.modules.core.DeviceEventManagerModule
import okhttp3.OkHttpClient
import okhttp3.Request
import java.io.File
import java.io.FileOutputStream
import java.util.concurrent.TimeUnit

class TikTokBackgroundModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    companion object {
        const val NOTIFICATION_CHANNEL_ID = "tiktoktoe_alerts_channel"
    }

    override fun getName(): String = "TikTokBackgroundModule"

    @ReactMethod
    fun startForegroundService(title: String, message: String, promise: Promise) {
        try {
            val intent = Intent(reactContext, TikTokForegroundService::class.java).apply {
                action = TikTokForegroundService.ACTION_START
                putExtra("title", title)
                putExtra("message", message)
            }
            ContextCompat.startForegroundService(reactContext, intent)
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("START_SERVICE_ERROR", e.message, e)
        }
    }

    @ReactMethod
    fun stopForegroundService(promise: Promise) {
        try {
            val intent = Intent(reactContext, TikTokForegroundService::class.java).apply {
                action = TikTokForegroundService.ACTION_STOP
            }
            reactContext.startService(intent)
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("STOP_SERVICE_ERROR", e.message, e)
        }
    }

    @ReactMethod
    fun isForegroundServiceRunning(promise: Promise) {
        promise.resolve(TikTokForegroundService.isServiceRunning)
    }

    @SuppressLint("ScheduleExactAlarm")
    @ReactMethod
    fun scheduleExactAlarm(id: String, timestampMs: Double, promise: Promise) {
        try {
            val alarmManager = reactContext.getSystemService(Context.ALARM_SERVICE) as? AlarmManager
            if (alarmManager == null) {
                promise.reject("ALARM_ERROR", "AlarmManager not available")
                return
            }

            val intent = Intent(reactContext, StreakAlarmReceiver::class.java).apply {
                action = "com.fatpro.tiktoktoe.ACTION_STREAK_ALARM"
                putExtra("taskId", id)
            }

            val requestCode = Math.abs(id.hashCode())
            val pendingIntent = PendingIntent.getBroadcast(
                reactContext,
                requestCode,
                intent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )

            val triggerAtMillis = timestampMs.toLong()

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                alarmManager.setExactAndAllowWhileIdle(
                    AlarmManager.RTC_WAKEUP,
                    triggerAtMillis,
                    pendingIntent
                )
            } else {
                alarmManager.setExact(
                    AlarmManager.RTC_WAKEUP,
                    triggerAtMillis,
                    pendingIntent
                )
            }

            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("SCHEDULE_ALARM_ERROR", e.message, e)
        }
    }

    @ReactMethod
    fun cancelExactAlarm(id: String, promise: Promise) {
        try {
            val alarmManager = reactContext.getSystemService(Context.ALARM_SERVICE) as? AlarmManager
            val intent = Intent(reactContext, StreakAlarmReceiver::class.java).apply {
                action = "com.fatpro.tiktoktoe.ACTION_STREAK_ALARM"
                putExtra("taskId", id)
            }
            val requestCode = Math.abs(id.hashCode())
            val pendingIntent = PendingIntent.getBroadcast(
                reactContext,
                requestCode,
                intent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )
            alarmManager?.cancel(pendingIntent)
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("CANCEL_ALARM_ERROR", e.message, e)
        }
    }

    @SuppressLint("MissingPermission")
    @ReactMethod
    fun showLocalNotification(title: String, message: String, promise: Promise) {
        try {
            createAlertsChannel()

            val launchIntent = reactContext.packageManager.getLaunchIntentForPackage(reactContext.packageName)
            val pendingIntent = PendingIntent.getActivity(
                reactContext,
                (System.currentTimeMillis() % 10000).toInt(),
                launchIntent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )

            val notification = NotificationCompat.Builder(reactContext, NOTIFICATION_CHANNEL_ID)
                .setContentTitle(title)
                .setContentText(message)
                .setSmallIcon(R.mipmap.ic_launcher)
                .setContentIntent(pendingIntent)
                .setAutoCancel(true)
                .setPriority(NotificationCompat.PRIORITY_HIGH)
                .build()

            val notificationId = (System.currentTimeMillis() % 100000).toInt() + 100
            val manager = NotificationManagerCompat.from(reactContext)
            manager.notify(notificationId, notification)

            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("NOTIFICATION_ERROR", e.message, e)
        }
    }

    @ReactMethod
    fun isIgnoringBatteryOptimizations(promise: Promise) {
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                val powerManager = reactContext.getSystemService(Context.POWER_SERVICE) as? PowerManager
                val isIgnoring = powerManager?.isIgnoringBatteryOptimizations(reactContext.packageName) ?: false
                promise.resolve(isIgnoring)
            } else {
                promise.resolve(true)
            }
        } catch (e: Exception) {
            promise.resolve(false)
        }
    }

    @ReactMethod
    fun requestIgnoreBatteryOptimizations(promise: Promise) {
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                val intent = Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS).apply {
                    data = Uri.parse("package:" + reactContext.packageName)
                    addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                }
                reactContext.startActivity(intent)
            }
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("BATTERY_OPT_ERROR", e.message, e)
        }
    }

    @ReactMethod
    fun downloadMediaWithProgress(
        mediaUrl: String,
        pageUrl: String?,
        fileName: String,
        title: String,
        mimeType: String,
        customCookie: String?,
        promise: Promise
    ) {
        Thread {
            try {
                val userAgent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36"
                val okHttpClient = OkHttpClient.Builder()
                    .followRedirects(true)
                    .followSslRedirects(true)
                    .connectTimeout(30, TimeUnit.SECONDS)
                    .readTimeout(60, TimeUnit.SECONDS)
                    .build()

                var cookieHeader = customCookie?.trim() ?: ""

                // 1. Use cookies from Android CookieManager if available
                if (cookieHeader.isEmpty()) {
                    val cookieManager = CookieManager.getInstance()
                    val webkitCookies = cookieManager.getCookie("https://www.tiktok.com")
                    if (!webkitCookies.isNullOrEmpty()) {
                        cookieHeader = webkitCookies
                    }
                }

                // 2. If session token is missing and pageUrl exists, fetch headers to extract Set-Cookie
                if (!cookieHeader.contains("tt_chain_token") && !pageUrl.isNullOrEmpty()) {
                    try {
                        val pageReq = Request.Builder()
                            .url(pageUrl)
                            .header("User-Agent", userAgent)
                            .header("Accept", "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8")
                            .build()
                        val pageResp = okHttpClient.newCall(pageReq).execute()
                        val setCookies = pageResp.headers("Set-Cookie")
                        val freshCookies = setCookies.map { it.split(";")[0] }.joinToString("; ")
                        pageResp.close()
                        if (freshCookies.isNotEmpty()) {
                            cookieHeader = if (cookieHeader.isNotEmpty()) "$cookieHeader; $freshCookies" else freshCookies
                        }
                    } catch (_: Exception) {
                        // Continue with available headers
                    }
                }

                // 3. Initialize streaming download request from ByteDance CDN
                val reqBuilder = Request.Builder()
                    .url(mediaUrl)
                    .header("User-Agent", userAgent)
                    .header("Referer", "https://www.tiktok.com/")
                    .header("Range", "bytes=0-")

                if (cookieHeader.isNotEmpty()) {
                    reqBuilder.header("Cookie", cookieHeader)
                }

                val request = reqBuilder.build()
                val response = okHttpClient.newCall(request).execute()

                if (!response.isSuccessful && response.code != 206) {
                    val code = response.code
                    response.close()
                    sendDownloadProgress(fileName, -1.0, 0, 0, "failed")
                    promise.reject("DOWNLOAD_ERROR", "Máy chủ phản hồi mã lỗi HTTP $code")
                    return@Thread
                }

                val responseBody = response.body
                if (responseBody == null) {
                    response.close()
                    sendDownloadProgress(fileName, -1.0, 0, 0, "failed")
                    promise.reject("DOWNLOAD_ERROR", "Dữ liệu phản hồi từ máy chủ trống")
                    return@Thread
                }

                val totalBytes = responseBody.contentLength()
                val downloadsDir = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS)
                if (!downloadsDir.exists()) {
                    downloadsDir.mkdirs()
                }
                val destinationFile = File(downloadsDir, fileName)

                var bytesCopied: Long = 0
                val buffer = ByteArray(16 * 1024)
                val inputStream = responseBody.byteStream()
                val outputStream = FileOutputStream(destinationFile)

                var lastReportTime = 0L

                inputStream.use { input ->
                    outputStream.use { output ->
                        var bytes = input.read(buffer)
                        while (bytes >= 0) {
                            output.write(buffer, 0, bytes)
                            bytesCopied += bytes
                            val now = System.currentTimeMillis()
                            if (now - lastReportTime >= 150) {
                                lastReportTime = now
                                val percent = if (totalBytes > 0) (bytesCopied.toDouble() / totalBytes.toDouble()) * 100.0 else 0.0
                                sendDownloadProgress(fileName, percent, bytesCopied, totalBytes, "downloading")
                            }
                            bytes = input.read(buffer)
                        }
                        output.flush()
                    }
                }
                response.close()

                // Report 100% completion
                sendDownloadProgress(fileName, 100.0, bytesCopied, bytesCopied, "completed")

                // Scan into Android MediaStore/Gallery for immediate visibility
                MediaScannerConnection.scanFile(
                    reactContext,
                    arrayOf(destinationFile.absolutePath),
                    arrayOf(mimeType)
                ) { _, _ -> }

                // Display download completion notification in Android status bar
                showDownloadNotification(title, "Saved to Downloads: $fileName")

                val resultMap = Arguments.createMap().apply {
                    putBoolean("success", true)
                    putString("filePath", destinationFile.absolutePath)
                    putString("fileName", fileName)
                    putDouble("size", bytesCopied.toDouble())
                }
                promise.resolve(resultMap)

            } catch (e: Exception) {
                sendDownloadProgress(fileName, -1.0, 0, 0, "failed")
                promise.reject("DOWNLOAD_EXCEPTION", e.message, e)
            }
        }.start()
    }

    @ReactMethod
    fun downloadMediaFile(url: String, fileName: String, title: String, mimeType: String, promise: Promise) {
        // Automatically delegate to standalone native streaming engine
        downloadMediaWithProgress(url, null, fileName, title, mimeType, null, promise)
    }

    private fun sendDownloadProgress(fileName: String, percent: Double, bytesRead: Long, totalBytes: Long, status: String) {
        try {
            val map = Arguments.createMap().apply {
                putString("fileName", fileName)
                putDouble("percent", percent)
                putDouble("bytesRead", bytesRead.toDouble())
                putDouble("totalBytes", totalBytes.toDouble())
                putString("status", status)
            }
            reactContext.getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
                .emit("onDownloadProgress", map)
        } catch (_: Exception) {}
    }

    @SuppressLint("MissingPermission")
    private fun showDownloadNotification(title: String, message: String) {
        try {
            createAlertsChannel()
            val notification = NotificationCompat.Builder(reactContext, NOTIFICATION_CHANNEL_ID)
                .setContentTitle(title)
                .setContentText(message)
                .setSmallIcon(R.mipmap.ic_launcher)
                .setAutoCancel(true)
                .setPriority(NotificationCompat.PRIORITY_HIGH)
                .build()

            val notificationId = (System.currentTimeMillis() % 100000).toInt() + 200
            NotificationManagerCompat.from(reactContext).notify(notificationId, notification)
        } catch (_: Exception) {}
    }


    @ReactMethod
    fun getClipboardText(promise: Promise) {
        try {
            val clipboard = reactContext.getSystemService(Context.CLIPBOARD_SERVICE) as? ClipboardManager
            val clipData = clipboard?.primaryClip
            if (clipData != null && clipData.itemCount > 0) {
                val text = clipData.getItemAt(0).text?.toString() ?: ""
                promise.resolve(text)
            } else {
                promise.resolve("")
            }
        } catch (e: Exception) {
            promise.resolve("")
        }
    }

    @ReactMethod
    fun setClipboardText(text: String, promise: Promise) {
        try {
            val clipboard = reactContext.getSystemService(Context.CLIPBOARD_SERVICE) as? ClipboardManager
            val clip = ClipData.newPlainText("TikTokToe", text)
            clipboard?.setPrimaryClip(clip)
            promise.resolve(true)
        } catch (e: Exception) {
            promise.resolve(false)
        }
    }

    private fun createAlertsChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                NOTIFICATION_CHANNEL_ID,
                "Thông báo gửi tin nhắn TikTokToe",
                NotificationManager.IMPORTANCE_HIGH
            ).apply {
                description = "Thông báo kết quả gửi tin nhắn giữ chuỗi tự động"
            }
            val manager = reactContext.getSystemService(Context.NOTIFICATION_SERVICE) as? NotificationManager
            manager?.createNotificationChannel(channel)
        }
    }
}
