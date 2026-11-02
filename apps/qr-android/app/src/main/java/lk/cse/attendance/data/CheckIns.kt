package lk.cse.attendance.data

import android.os.Build
import android.os.SystemClock
import java.util.UUID
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Deferred
import kotlinx.coroutines.async
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import lk.cse.attendance.MainActivity
import lk.cse.attendance.core.QrPayload
import lk.cse.attendance.core.SignedMessages
import lk.cse.attendance.scan.ScanStats
import lk.cse.attendance.security.AuthCancelledException
import lk.cse.attendance.security.KeyInvalidatedException

/**
 * What the scanner hands over after reading a check-in code.
 * All times are SystemClock.elapsedRealtimeNanos (PLAN §5.2):
 * t0 = Scan pressed, tFirstFrame, t1 = first successful decode.
 */
data class DecodedScan(
    val token: String,
    val t0Nanos: Long,
    val stats: ScanStats,
    /** Read when the scanner opened; null if not read yet. */
    val ssid: String?,
)

sealed interface CheckInOutcome {
    data class Done(val response: CheckinResponse, val timings: Timings) : CheckInOutcome
    /** Sent, but no reply. Retrying sends the same signed request; the server keeps one record. */
    data class NoReply(val message: String) : CheckInOutcome
    data object Cancelled : CheckInOutcome
    data class Failed(val message: String, val setUpAgain: Boolean = false) : CheckInOutcome
}

data class Timings(val decodeMs: Double, val biometricMs: Double, val postRttMs: Double, val totalMs: Double, val framesProcessed: Int)

private const val NS_PER_MS = 1_000_000.0

/** Runs a check-in and keeps the attempt log (Room) in step with the server. */
class CheckIns(private val session: Session, private val dao: AttemptDao) {
    private val prefs get() = session.prefs
    private val api get() = session.api
    private val uploadLock = Mutex()
    private val background = CoroutineScope(SupervisorJob() + Dispatchers.IO)

    /** Handed from the scanner to the check-in screen. */
    @Volatile var pending: DecodedScan? = null

    /** The signed request of an attempt that got no reply, for "Try again". */
    private var unanswered: Pair<String, CheckinRequest>? = null

    private data class Labels(val phoneLabel: String?, val distanceRow: String?, val distanceM: Double?, val role: String?, val runNo: Int?, val attemptNo: Int?)

    /** Labels for the next attempt (experiment mode only); moves the attempt counter on. */
    private fun takeLabels(): Labels {
        if (!prefs.labelsOn) return Labels(null, null, null, null, null, null)
        val n = prefs.nextAttemptNo
        prefs.nextAttemptNo = n + 1
        return Labels(prefs.phoneLabel, prefs.distanceRow, prefs.distanceM.toDoubleOrNull(), prefs.role, prefs.runNo, n)
    }

    private fun ms(fromNanos: Long, toNanos: Long) = (toNanos - fromNanos) / NS_PER_MS

    private fun baseEntity(id: String, labels: Labels, verdict: String) = AttemptEntity(
        id = id,
        createdAtMs = System.currentTimeMillis(),
        phoneLabel = labels.phoneLabel,
        distanceRow = labels.distanceRow,
        distanceM = labels.distanceM,
        role = labels.role,
        runNo = labels.runNo,
        attemptNo = labels.attemptNo,
        androidSdk = Build.VERSION.SDK_INT,
        verdict = verdict,
    )

    /** No code within the timeout (PLAN §5.2: NO_DECODE). */
    suspend fun logNoDecode(t0Nanos: Long, stats: ScanStats, ssid: String?, timeoutSec: Int) {
        val e = baseEntity(UUID.randomUUID().toString(), takeLabels(), "NO_DECODE").copy(
            reason = "No code within $timeoutSec s",
            firstFrameMs = stats.firstFrameNanos.takeIf { it > 0 }?.let { ms(t0Nanos, it) },
            framesProcessed = stats.framesProcessed,
            framesDropped = stats.framesDropped,
            totalMs = ms(t0Nanos, SystemClock.elapsedRealtimeNanos()),
            ssid = ssid,
        )
        dao.upsert(e)
        uploadInBackground()
    }

    /** The scanner was closed before a code was read (logged in experiment mode). */
    suspend fun logScannerClosed(t0Nanos: Long, stats: ScanStats, ssid: String?) {
        if (!prefs.labelsOn) return
        val e = baseEntity(UUID.randomUUID().toString(), takeLabels(), "CANCELLED").copy(
            reason = "Scanner closed before a code was read",
            firstFrameMs = stats.firstFrameNanos.takeIf { it > 0 }?.let { ms(t0Nanos, it) },
            framesProcessed = stats.framesProcessed,
            framesDropped = stats.framesDropped,
            totalMs = ms(t0Nanos, SystemClock.elapsedRealtimeNanos()),
            ssid = ssid,
        )
        dao.upsert(e)
        uploadInBackground()
    }

    /**
     * The check-in itself: fingerprint/PIN, sign "QRv1-CHK|token|deviceId|attemptId",
     * POST, record t2 (signature made) and t3 (reply received).
     */
    suspend fun run(activity: MainActivity, scan: DecodedScan): CheckInOutcome {
        val deviceId = session.deviceId ?: return CheckInOutcome.Failed("This phone isn't set up.", setUpAgain = true)
        val id = UUID.randomUUID().toString()
        val labels = takeLabels()
        val t1 = scan.stats.decodedNanos
        var entity = baseEntity(id, labels, "PENDING").copy(
            token = scan.token,
            firstFrameMs = scan.stats.firstFrameNanos.takeIf { it > 0 }?.let { ms(scan.t0Nanos, it) },
            decodeMs = ms(scan.t0Nanos, t1),
            framesProcessed = scan.stats.framesProcessed,
            framesDropped = scan.stats.framesDropped,
            ssid = scan.ssid,
        )
        dao.upsert(entity)
        // If the scanner hadn't read the Wi-Fi name yet, read it during the fingerprint prompt.
        val ssid: Deferred<String> = scan.ssid?.let { CompletableDeferred(it) } ?: background.async { WifiReader.read(activity).ssid }

        // Make sure the access token won't run out mid-check-in (may need a login prompt, rarely).
        try {
            api.ensureFresh()
        } catch (e: NeedsLoginException) {
            try {
                session.logIn(activity)
            } catch (e: Exception) {
                return finishLocal(entity.copy(verdict = "CANCELLED", reason = "Login needed: ${e.message}"), e)
            }
        } catch (e: ApiException) {
            return finishLocal(entity.copy(verdict = "NETWORK_ERROR", reason = e.message), e)
        }

        val signed = try {
            session.userAuth(activity).sign(
                SignedMessages.checkIn(scan.token, deviceId, id),
                title = "Check in",
                subtitle = "Confirm it's you",
            )
        } catch (e: Exception) {
            return finishLocal(
                entity.copy(verdict = "CANCELLED", reason = if (e is AuthCancelledException) "Fingerprint or PIN cancelled" else e.message, biometricMs = ms(t1, SystemClock.elapsedRealtimeNanos())),
                e,
            )
        }
        val t2 = SystemClock.elapsedRealtimeNanos()
        entity = entity.copy(biometricMs = ms(t1, t2), authMethod = signed.authMethod, ssid = ssid.await())
        dao.upsert(entity)

        val request = CheckinRequest(
            token = QrPayload.CheckIn(scan.token).text,
            attemptId = id,
            signature = signed.signature,
            ssid = entity.ssid,
            phoneLabel = labels.phoneLabel,
            distanceRow = labels.distanceRow,
            distanceM = labels.distanceM,
            role = labels.role,
            runNo = labels.runNo,
            attemptNo = labels.attemptNo,
            firstFrameMs = entity.firstFrameMs,
            decodeMs = entity.decodeMs,
            framesProcessed = entity.framesProcessed,
            framesDropped = entity.framesDropped,
            biometricMs = entity.biometricMs,
            authMethod = signed.authMethod,
            androidSdk = Build.VERSION.SDK_INT,
        )
        return send(entity, request, scan.t0Nanos, t2)
    }

    /** "Try again" after no reply: the same signed request, so the server keeps one record. */
    suspend fun retry(): CheckInOutcome {
        val (id, request) = unanswered ?: return CheckInOutcome.Failed("Nothing to send again. Scan the code again.")
        val entity = dao.get(id) ?: return CheckInOutcome.Failed("Nothing to send again. Scan the code again.")
        val t2 = SystemClock.elapsedRealtimeNanos()
        return send(entity.copy(reason = "Sent again after no reply"), request, null, t2)
    }

    private suspend fun send(entity: AttemptEntity, request: CheckinRequest, t0Nanos: Long?, t2: Long): CheckInOutcome {
        val response = try {
            api.checkIn(request)
        } catch (e: ApiException) {
            val noReply = e.code == "NETWORK" || e.status >= 500
            dao.upsert(entity.copy(verdict = "NETWORK_ERROR", reason = e.message))
            if (noReply) {
                unanswered = entity.id to request
                return CheckInOutcome.NoReply(e.message)
            }
            return CheckInOutcome.Failed(e.message, setUpAgain = e.isRevoked)
        } catch (e: NeedsLoginException) {
            dao.upsert(entity.copy(verdict = "NETWORK_ERROR", reason = "Login expired"))
            return CheckInOutcome.Failed("Your login expired. Open the app's home screen to confirm it's you, then scan again.")
        }
        val t3 = SystemClock.elapsedRealtimeNanos()
        unanswered = null
        val postRttMs = ms(t2, t3)
        // After a retry there is no single t0 → t3 path, so total time is only kept for the first send.
        val totalMs = t0Nanos?.let { ms(it, t3) }
        dao.upsert(
            entity.copy(
                verdict = response.verdict,
                attendance = response.attendance,
                reason = if (response.verdict == "OK") entity.reason else response.message,
                tokenAgeMs = response.tokenAgeMs,
                seq = response.seq,
                postRttMs = postRttMs,
                totalMs = totalMs ?: entity.totalMs,
                sentToServer = true,
                uploaded = false,
            ),
        )
        uploadInBackground()
        return CheckInOutcome.Done(
            response,
            Timings(entity.decodeMs ?: 0.0, entity.biometricMs ?: 0.0, postRttMs, totalMs ?: 0.0, entity.framesProcessed ?: 0),
        )
    }

    private suspend fun finishLocal(entity: AttemptEntity, e: Exception): CheckInOutcome {
        dao.upsert(entity)
        uploadInBackground()
        return when (e) {
            is AuthCancelledException -> CheckInOutcome.Cancelled
            is KeyInvalidatedException -> CheckInOutcome.Failed(e.message ?: "Set up the app again.", setUpAgain = true)
            is ApiException -> if (e.code == "NETWORK") CheckInOutcome.NoReply(e.message) else CheckInOutcome.Failed(e.message, e.isRevoked)
            else -> CheckInOutcome.Failed(e.message ?: "Something went wrong. Try again.")
        }
    }

    fun uploadInBackground() {
        background.launch { runCatching { upload() } }
    }

    /**
     * Sends every attempt not yet uploaded: new ones with their phone-side verdict,
     * and the timings measured after the reply for the ones the server has.
     * Returns how many were saved.
     */
    suspend fun upload(): Int = uploadLock.withLock {
        val pending = dao.pending()
        if (pending.isEmpty()) return 0
        val res = api.uploadAttempts(AttemptUploadRequest(pending.map { it.toUpload() }))
        dao.markUploaded(res.saved)
        res.saved.size
    }

    private fun AttemptEntity.toUpload() = AttemptUpload(
        id = id,
        verdict = if (sentToServer) null else verdict,
        reason = reason,
        token = token?.let { QrPayload.CheckIn(it).text },
        ssid = ssid,
        phoneLabel = phoneLabel,
        distanceRow = distanceRow,
        distanceM = distanceM,
        role = role,
        runNo = runNo,
        attemptNo = attemptNo,
        firstFrameMs = firstFrameMs,
        decodeMs = decodeMs,
        framesProcessed = framesProcessed,
        framesDropped = framesDropped,
        biometricMs = biometricMs,
        postRttMs = postRttMs,
        totalMs = totalMs,
        authMethod = authMethod,
        androidSdk = androidSdk,
    )
}
