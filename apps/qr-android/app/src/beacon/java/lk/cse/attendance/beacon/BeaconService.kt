package lk.cse.attendance.beacon

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.IBinder
import android.os.PowerManager
import android.os.SystemClock
import android.util.Base64
import androidx.core.app.NotificationCompat
import androidx.core.app.ServiceCompat
import androidx.core.content.ContextCompat
import java.time.Instant
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import lk.cse.attendance.R
import lk.cse.attendance.core.BeaconCode
import lk.cse.attendance.data.ApiException

/** What the beacon is doing, for the screen and the notification. */
data class BeaconUi(
    val running: Boolean = false,
    val run: BeaconRun? = null,
    val broadcasting: Boolean = false,
    val problem: Problem? = null,
    /** The server couldn't be reached on the last poll. */
    val offline: Boolean = false,
    val unlinked: String? = null,
)

/**
 * Runs while the phone is "on duty" (PLAN §6.5). Every 2 s it tells the server it's
 * alive and asks for the lecturer's open check-in; while there is one, it broadcasts
 * that run's rotating code. Start / End check-in in the portal switch it on and off.
 */
class BeaconService : Service() {
    companion object {
        private const val CHANNEL = "beacon"
        private const val NOTIFICATION_ID = 1
        private const val POLL_MS = 2_000L
        /** Keep broadcasting a known run this long without the server, then stop. */
        private const val OFFLINE_GRACE_MS = 5 * 60_000L

        private val _ui = MutableStateFlow(BeaconUi())
        val ui: StateFlow<BeaconUi> = _ui

        fun start(context: Context) = ContextCompat.startForegroundService(context, Intent(context, BeaconService::class.java))

        fun stop(context: Context) = context.stopService(Intent(context, BeaconService::class.java))
    }

    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Default)
    private var loop: Job? = null
    private lateinit var broadcaster: Broadcaster
    private var wakeLock: PowerManager.WakeLock? = null

    // Server time estimate: server clock at the last poll + monotonic time since then.
    private var serverAtPollMs = 0L
    private var elapsedAtPollMs = 0L
    private var lastOkElapsedMs = 0L

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onCreate() {
        super.onCreate()
        broadcaster = Broadcaster(this)
        createChannel()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        val type = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) ServiceInfo.FOREGROUND_SERVICE_TYPE_CONNECTED_DEVICE else 0
        ServiceCompat.startForeground(this, NOTIFICATION_ID, notification(BeaconUi(running = true)), type)
        if (wakeLock == null) {
            wakeLock = getSystemService(PowerManager::class.java)
                .newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "cse-attendance:beacon")
                .apply { acquire(10 * 60 * 60_000L) }
        }
        if (loop?.isActive != true) loop = scope.launch { run() }
        return START_STICKY
    }

    override fun onDestroy() {
        scope.cancel()
        broadcaster.stop()
        wakeLock?.takeIf { it.isHeld }?.release()
        wakeLock = null
        _ui.value = BeaconUi(running = false)
        super.onDestroy()
    }

    private suspend fun run() {
        val app = application as BeaconApp
        var run: BeaconRun? = null
        var key: ByteArray? = null
        var lastSeq = -1L
        var nextPoll = 0L
        while (scope.isActive) {
            val now = SystemClock.elapsedRealtime()
            val problem = broadcaster.problem()
            if (now >= nextPoll) {
                nextPoll = now + POLL_MS
                val state = problem?.serverState ?: if (broadcaster.active) "broadcasting" else "waiting"
                try {
                    val cur = app.api.current(state)
                    serverAtPollMs = Instant.parse(cur.serverTime).toEpochMilli()
                    elapsedAtPollMs = SystemClock.elapsedRealtime()
                    lastOkElapsedMs = elapsedAtPollMs
                    if (cur.run?.windowId != run?.windowId) lastSeq = -1
                    run = cur.run
                    key = run?.let { Base64.decode(it.key, Base64.DEFAULT) }
                    app.prefs.lecturer = cur.lecturer
                } catch (e: UnlinkedException) {
                    broadcaster.stop()
                    publish(BeaconUi(running = false, unlinked = e.message))
                    stopSelf()
                    return
                } catch (e: ApiException) {
                    // Keep a known run going through short network drops.
                    if (now - lastOkElapsedMs > OFFLINE_GRACE_MS) run = null
                }
            }

            val r = run
            val k = key
            if (problem == null && r != null && k != null) {
                val serverNow = serverAtPollMs + (SystemClock.elapsedRealtime() - elapsedAtPollMs)
                val seq = BeaconCode.seqAt(Instant.parse(r.startedAt).toEpochMilli(), serverNow)
                if (seq != lastSeq || !broadcaster.active) {
                    broadcaster.advertise(BeaconCode.payload(k, seq), app.prefs.power)
                    lastSeq = seq
                }
            } else if (broadcaster.active) {
                broadcaster.stop()
                lastSeq = -1
            }
            publish(
                BeaconUi(
                    running = true,
                    run = r,
                    broadcasting = broadcaster.active,
                    problem = problem,
                    offline = SystemClock.elapsedRealtime() - lastOkElapsedMs > POLL_MS * 3,
                ),
            )
            delay(250)
        }
    }

    private fun publish(ui: BeaconUi) {
        if (ui == _ui.value) return
        val changedText = text(ui) != text(_ui.value)
        _ui.value = ui
        if (changedText && ui.running) getSystemService(NotificationManager::class.java).notify(NOTIFICATION_ID, notification(ui))
    }

    private fun text(ui: BeaconUi): String = when {
        ui.problem == Problem.BLUETOOTH_OFF -> "Bluetooth is off. Turn it on to broadcast."
        ui.problem == Problem.NO_PERMISSION -> "Allow Nearby devices in the app."
        ui.problem == Problem.CANT_BROADCAST -> "This phone can't broadcast the beacon."
        ui.broadcasting && ui.run != null -> "Broadcasting · ${ui.run.module.code} · ${ui.run.session.title}"
        ui.offline -> "No connection to the server"
        else -> "Waiting for check-in"
    }

    private fun notification(ui: BeaconUi): Notification {
        val open = PendingIntent.getActivity(
            this, 0, Intent(this, BeaconActivity::class.java), PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT,
        )
        return NotificationCompat.Builder(this, CHANNEL)
            .setSmallIcon(R.drawable.ic_launcher_foreground)
            .setContentTitle(getString(R.string.beacon_app_name))
            .setContentText(text(ui))
            .setOngoing(true)
            .setOnlyAlertOnce(true)
            .setContentIntent(open)
            .setForegroundServiceBehavior(NotificationCompat.FOREGROUND_SERVICE_IMMEDIATE)
            .build()
    }

    private fun createChannel() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
        val channel = NotificationChannel(CHANNEL, "Classroom beacon", NotificationManager.IMPORTANCE_LOW).apply {
            description = "Shows whether the beacon is broadcasting"
        }
        getSystemService(NotificationManager::class.java).createNotificationChannel(channel)
    }
}
