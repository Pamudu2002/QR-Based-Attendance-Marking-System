package lk.cse.attendance.data

import android.os.SystemClock
import java.io.IOException
import java.util.concurrent.TimeUnit
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.coroutines.withContext
import kotlinx.serialization.KSerializer
import kotlinx.serialization.json.Json
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody

/** A failed call. `message` is written for the student and can be shown as is. */
class ApiException(val status: Int, val code: String, override val message: String) : Exception(message) {
    val isRevoked get() = code == "DEVICE_REVOKED"
}

/** The refresh token is gone or rejected: the phone must sign a new login challenge. */
class NeedsLoginException : Exception("Confirm it's you to continue.")

class Api(private val prefs: Prefs) {
    private val http = OkHttpClient.Builder()
        .connectTimeout(10, TimeUnit.SECONDS)
        .readTimeout(20, TimeUnit.SECONDS)
        .build()
    private val json = Json { ignoreUnknownKeys = true; explicitNulls = false; encodeDefaults = false }
    private val jsonType = "application/json".toMediaType()
    private val refreshLock = Mutex()

    @Volatile private var accessToken: String? = null
    /** elapsedRealtime (ms) when the access token expires. */
    @Volatile private var accessExpiresAt = 0L

    private val base get() = prefs.serverUrl.trimEnd('/') + "/api/v1"

    // ── Setup and login (no access token) ─────────────────────────────────

    suspend fun createDevice(body: CreateDeviceRequest) =
        call("POST", "/devices", body, CreateDeviceRequest.serializer(), CreateDeviceResponse.serializer(), null)

    suspend fun challenge(deviceId: String) =
        call("POST", "/auth/device/challenge", ChallengeRequest(deviceId), ChallengeRequest.serializer(), ChallengeResponse.serializer(), null)

    suspend fun verify(body: VerifyRequest): TokenResponse {
        val tokens = call("POST", "/auth/device/verify", body, VerifyRequest.serializer(), TokenResponse.serializer(), null)
        keep(tokens)
        return tokens
    }

    fun forgetTokens() {
        accessToken = null
        accessExpiresAt = 0L
        prefs.refreshToken = null
    }

    private fun keep(tokens: TokenResponse) {
        accessToken = tokens.accessToken
        accessExpiresAt = SystemClock.elapsedRealtime() + tokens.expiresInSec * 1000L
        prefs.refreshToken = tokens.refreshToken
    }

    /**
     * Refresh now if the access token runs out within a minute. Called before a
     * check-in so a 401 retry can't land between the signature and the reply.
     */
    suspend fun ensureFresh() {
        val token = accessToken
        if (token == null || SystemClock.elapsedRealtime() > accessExpiresAt - 60_000) refresh(token)
    }

    // ── Student calls (access token, refreshed when needed) ──────────────

    suspend fun me() = authed<Unit, MeResponse>("GET", "/student/me", null, null, MeResponse.serializer())

    suspend fun modules() = authed<Unit, ModulesResponse>("GET", "/student/modules", null, null, ModulesResponse.serializer())

    suspend fun module(id: String) = authed<Unit, ModuleDetailResponse>("GET", "/student/modules/$id", null, null, ModuleDetailResponse.serializer())

    suspend fun previewRegistration(token: String) =
        authed("POST", "/student/registrations/preview", PreviewRequest(token), PreviewRequest.serializer(), PreviewResponse.serializer())

    suspend fun register(body: RegisterRequest) =
        authed("POST", "/student/registrations", body, RegisterRequest.serializer(), RegisterResponse.serializer())

    suspend fun checkIn(body: CheckinRequest) =
        authed("POST", "/checkins", body, CheckinRequest.serializer(), CheckinResponse.serializer())

    suspend fun uploadAttempts(body: AttemptUploadRequest) =
        authed("POST", "/attempts/bulk", body, AttemptUploadRequest.serializer(), AttemptUploadResponse.serializer())

    private suspend fun <B, T> authed(method: String, path: String, body: B?, inSer: KSerializer<B>?, outSer: KSerializer<T>): T {
        val token = accessToken ?: refresh(null)
        return try {
            call(method, path, body, inSer, outSer, token)
        } catch (e: ApiException) {
            if (e.status != 401) throw e
            call(method, path, body, inSer, outSer, refresh(token))
        }
    }

    /** Rotates the refresh token. Only one refresh runs at a time; each token works once. */
    private suspend fun refresh(stale: String?): String = refreshLock.withLock {
        accessToken?.let { if (it != stale && SystemClock.elapsedRealtime() < accessExpiresAt - 60_000) return it }
        val refreshToken = prefs.refreshToken ?: throw NeedsLoginException()
        try {
            val tokens = call("POST", "/auth/refresh", RefreshRequest(refreshToken), RefreshRequest.serializer(), TokenResponse.serializer(), null)
            keep(tokens)
            tokens.accessToken
        } catch (e: ApiException) {
            if (e.status == 401) {
                prefs.refreshToken = null
                throw NeedsLoginException()
            }
            throw e
        }
    }

    private suspend fun <B, T> call(
        method: String,
        path: String,
        body: B?,
        inSer: KSerializer<B>?,
        outSer: KSerializer<T>,
        bearer: String?,
    ): T = withContext(Dispatchers.IO) {
        val requestBody = if (body != null && inSer != null) json.encodeToString(inSer, body).toRequestBody(jsonType) else null
        val request = Request.Builder()
            .url(base + path)
            .method(method, requestBody ?: if (method == "POST") "{}".toRequestBody(jsonType) else null)
            .apply { if (bearer != null) header("Authorization", "Bearer $bearer") }
            .build()
        val response = try {
            http.newCall(request).execute()
        } catch (e: IOException) {
            throw ApiException(0, "NETWORK", "Couldn't reach the server. Check your connection and try again.")
        }
        response.use { res ->
            val text = res.body?.string().orEmpty()
            if (!res.isSuccessful) {
                val err = runCatching { json.decodeFromString(ErrorBody.serializer(), text).error }.getOrNull()
                throw ApiException(res.code, err?.code ?: "HTTP_${res.code}", err?.message ?: "Something went wrong on the server. Try again.")
            }
            try {
                json.decodeFromString(outSer, text)
            } catch (e: Exception) {
                throw ApiException(res.code, "BAD_RESPONSE", "The server sent an answer this app doesn't understand. Update the app.")
            }
        }
    }
}
