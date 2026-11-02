package lk.cse.attendance.beacon

import android.content.Context
import android.os.Build
import androidx.core.content.edit
import java.io.IOException
import java.util.concurrent.TimeUnit
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.coroutines.withContext
import kotlinx.serialization.KSerializer
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import lk.cse.attendance.BuildConfig
import lk.cse.attendance.core.SignedMessages
import lk.cse.attendance.data.ApiException
import lk.cse.attendance.data.ErrorBody

/** The beacon app's settings, separate from the student app's. */
class BeaconPrefs(context: Context) {
    private val sp = context.getSharedPreferences("cse_attendance_beacon", Context.MODE_PRIVATE)

    var serverUrl: String
        get() = sp.getString("serverUrl", null) ?: BuildConfig.SERVER_URL
        set(value) = sp.edit { putString("serverUrl", value.trim().trimEnd('/')) }

    var beaconId: String?
        get() = sp.getString("beaconId", null)
        set(value) = sp.edit { putString("beaconId", value) }

    var lecturer: String?
        get() = sp.getString("lecturer", null)
        set(value) = sp.edit { putString("lecturer", value) }

    /** Broadcast power: LOW, MEDIUM or HIGH (set after the range test in the hall). */
    var power: String
        get() = sp.getString("power", null) ?: "MEDIUM"
        set(value) = sp.edit { putString("power", value) }

    /** Whether the beacon service should run (the lecturer can pause it). */
    var onDuty: Boolean
        get() = sp.getBoolean("onDuty", true)
        set(value) = sp.edit { putBoolean("onDuty", value) }

    fun unlink() = sp.edit { remove("beaconId"); remove("lecturer") }
}

@Serializable data class LinkRequest(
    val code: String,
    val publicKey: String,
    val keyLevel: String,
    val model: String,
    val manufacturer: String,
    val androidSdk: Int,
    val signature: String,
)

@Serializable data class LinkResponse(val beaconId: String, val lecturer: String)

@Serializable private data class ChallengeRequest(val beaconId: String)

@Serializable private data class ChallengeResponse(val nonce: String)

@Serializable private data class VerifyRequest(val beaconId: String, val nonce: String, val signature: String)

@Serializable private data class VerifyResponse(val accessToken: String, val expiresInSec: Int)

@Serializable data class RunSession(val title: String, val venue: String)

@Serializable data class RunModule(val code: String, val displayName: String)

/** An open check-in to broadcast for; [key] is this run's derived beacon key (base64). */
@Serializable data class BeaconRun(
    val windowId: String,
    val key: String,
    val startedAt: String,
    val rotateSec: Int,
    val mode: String,
    val requireBeacon: Boolean,
    val session: RunSession,
    val module: RunModule,
)

@Serializable data class CurrentResponse(val serverTime: String, val lecturer: String, val run: BeaconRun? = null)

/** The phone was removed in the portal (or its key is gone): link it again. */
class UnlinkedException(message: String) : Exception(message)

/** Calls to the server's beacon endpoints. Logs itself in with the Keystore key whenever the access token runs out. */
class BeaconApi(private val prefs: BeaconPrefs) {
    private val http = OkHttpClient.Builder().connectTimeout(8, TimeUnit.SECONDS).readTimeout(10, TimeUnit.SECONDS).build()
    private val json = Json { ignoreUnknownKeys = true; explicitNulls = false; encodeDefaults = false }
    private val jsonType = "application/json".toMediaType()
    private val lock = Mutex()
    @Volatile private var accessToken: String? = null

    private val base get() = prefs.serverUrl.trimEnd('/') + "/api/v1"

    /** Links this phone with a scanned "QA1:B:…" code. Creates the key first. */
    suspend fun link(context: Context, qr: String): LinkResponse {
        val level = BeaconKey.create(context)
        val code = qr.trim().removePrefix("QA1:B:")
        val body = LinkRequest(
            code = qr.trim(),
            publicKey = BeaconKey.publicKeyBase64(),
            keyLevel = level,
            model = Build.MODEL,
            manufacturer = Build.MANUFACTURER,
            androidSdk = Build.VERSION.SDK_INT,
            signature = BeaconKey.sign(SignedMessages.beaconLink(code)),
        )
        val res = call("POST", "/beacon/link", body, LinkRequest.serializer(), LinkResponse.serializer(), null)
        prefs.beaconId = res.beaconId
        prefs.lecturer = res.lecturer
        accessToken = null
        return res
    }

    /** One poll: reports the phone's state, gets the run to broadcast for (or none). */
    suspend fun current(state: String): CurrentResponse {
        val token = accessToken ?: login()
        return try {
            call<Unit, CurrentResponse>("GET", "/beacon/current?state=$state", null, null, CurrentResponse.serializer(), token)
        } catch (e: ApiException) {
            if (e.status != 401 || e.code == "UNLINKED") throw unlinkedOr(e)
            call<Unit, CurrentResponse>("GET", "/beacon/current?state=$state", null, null, CurrentResponse.serializer(), login())
        }
    }

    private suspend fun login(): String = lock.withLock {
        val id = prefs.beaconId ?: throw UnlinkedException("Link this phone first.")
        try {
            val ch = call("POST", "/beacon/auth/challenge", ChallengeRequest(id), ChallengeRequest.serializer(), ChallengeResponse.serializer(), null)
            val signature = BeaconKey.sign(SignedMessages.beaconLogin(id, ch.nonce))
            val v = call("POST", "/beacon/auth/verify", VerifyRequest(id, ch.nonce, signature), VerifyRequest.serializer(), VerifyResponse.serializer(), null)
            accessToken = v.accessToken
            v.accessToken
        } catch (e: ApiException) {
            throw unlinkedOr(e)
        }
    }

    private fun unlinkedOr(e: ApiException): Exception =
        if (e.code == "UNLINKED" || e.code == "BAD_SIGNATURE") UnlinkedException(e.message) else e

    private suspend fun <B, T> call(method: String, path: String, body: B?, inSer: KSerializer<B>?, outSer: KSerializer<T>, bearer: String?): T =
        withContext(Dispatchers.IO) {
            val request = Request.Builder()
                .url(base + path)
                .method(method, if (body != null && inSer != null) json.encodeToString(inSer, body).toRequestBody(jsonType) else null)
                .apply { if (bearer != null) header("Authorization", "Bearer $bearer") }
                .build()
            val response = try {
                http.newCall(request).execute()
            } catch (e: IOException) {
                throw ApiException(0, "NETWORK", "Can't reach the server. Check the phone's internet connection.")
            }
            response.use { res ->
                val text = res.body?.string().orEmpty()
                if (!res.isSuccessful) {
                    val err = runCatching { json.decodeFromString(ErrorBody.serializer(), text).error }.getOrNull()
                    throw ApiException(res.code, err?.code ?: "HTTP_${res.code}", err?.message ?: "Something went wrong on the server. Try again.")
                }
                json.decodeFromString(outSer, text)
            }
        }
}
