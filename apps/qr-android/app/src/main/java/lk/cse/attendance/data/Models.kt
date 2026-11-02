package lk.cse.attendance.data

import kotlinx.serialization.Serializable

// Request and response bodies. The contract is docs/app-api.md.

@Serializable
data class ErrorBody(val error: ErrorDetail)

@Serializable
data class ErrorDetail(val code: String, val message: String)

@Serializable
data class CreateDeviceRequest(
    val publicKey: String,
    val keyLevel: String,
    val model: String,
    val manufacturer: String,
    val androidSdk: Int,
    val label: String? = null,
)

@Serializable
data class CreateDeviceResponse(val deviceId: String)

@Serializable
data class ChallengeRequest(val deviceId: String)

@Serializable
data class ChallengeResponse(val nonce: String, val expiresAt: String)

@Serializable
data class VerifyRequest(val deviceId: String, val nonce: String, val signature: String)

@Serializable
data class TokenResponse(val accessToken: String, val expiresInSec: Int, val refreshToken: String)

@Serializable
data class RefreshRequest(val refreshToken: String)

@Serializable
data class MeResponse(val device: MeDevice, val student: MeStudent? = null)

@Serializable
data class MeDevice(val id: String, val keyLevel: String, val status: String, val label: String? = null)

@Serializable
data class MeStudent(val indexNumber: String, val name: String? = null)

@Serializable
data class SessionBrief(
    val id: String,
    val title: String,
    val startsAt: String,
    val endsAt: String,
    val venue: String,
)

@Serializable
data class ModuleSummary(
    val id: String,
    val displayName: String,
    val code: String,
    val name: String,
    val lecturer: String,
    val nameOnList: String,
    val nextSession: SessionBrief? = null,
    val pastSessions: Int,
    val attended: Int,
    val attendancePct: Int? = null,
)

@Serializable
data class ModulesResponse(val modules: List<ModuleSummary>)

@Serializable
data class ModuleInfo(
    val id: String,
    val displayName: String,
    val shortName: String,
    val code: String,
    val name: String,
    val lecturer: String,
    val nameOnList: String,
)

@Serializable
data class SessionStatusItem(
    val id: String,
    val title: String,
    val startsAt: String,
    val endsAt: String,
    val venue: String,
    /** PRESENT, LATE, EXCUSED, ABSENT, UPCOMING or NOT_YET */
    val status: String,
    val markedAt: String? = null,
)

@Serializable
data class ModuleDetailResponse(
    val module: ModuleInfo,
    val pastSessions: Int,
    val attended: Int,
    val attendancePct: Int? = null,
    val upcoming: List<SessionStatusItem>,
    val history: List<SessionStatusItem>,
)

@Serializable
data class PreviewRequest(val token: String)

@Serializable
data class PreviewModule(
    val id: String,
    val displayName: String,
    val shortName: String,
    val name: String,
    val lecturer: String,
)

@Serializable
data class PreviewResponse(
    /** OK, REGISTRATION_CLOSED, BAD_TOKEN or EXPIRED */
    val verdict: String,
    val message: String,
    val module: PreviewModule? = null,
    val nameOnList: String? = null,
    val alreadyRegistered: Boolean = false,
    val codeValidForSec: Int = 0,
)

@Serializable
data class RegisterRequest(
    val token: String,
    val indexNumber: String? = null,
    val name: String? = null,
    val signature: String,
)

@Serializable
data class RegisterModule(val id: String, val displayName: String)

@Serializable
data class RegisterStudent(val indexNumber: String, val name: String)

@Serializable
data class RegisterResponse(
    val verdict: String,
    val message: String,
    val module: RegisterModule? = null,
    val student: RegisterStudent? = null,
)

// ── Check-in (week 3) ──────────────────────────────────────────────────────

@Serializable
data class CheckinRequest(
    val token: String,
    val attemptId: String,
    val signature: String,
    val ssid: String? = null,
    val phoneLabel: String? = null,
    val distanceRow: String? = null,
    val distanceM: Double? = null,
    val role: String? = null,
    val runNo: Int? = null,
    val attemptNo: Int? = null,
    val firstFrameMs: Double? = null,
    val decodeMs: Double? = null,
    val framesProcessed: Int? = null,
    val framesDropped: Int? = null,
    val biometricMs: Double? = null,
    val authMethod: String? = null,
    val androidSdk: Int? = null,
)

@Serializable
data class CheckinSession(val id: String, val title: String, val startsAt: String, val endsAt: String, val venue: String)

@Serializable
data class CheckinModule(val id: String, val code: String, val displayName: String)

@Serializable
data class CheckinSummary(val attended: Int, val pastSessions: Int, val attendancePct: Int? = null)

@Serializable
data class CheckinResponse(
    val attemptId: String,
    /** OK, EXPIRED, BAD_TOKEN, BAD_SIGNATURE, WRONG_NETWORK, UNKNOWN_DEVICE, DEVICE_REVOKED, NOT_REGISTERED, OUTSIDE_TIME, DUPLICATE */
    val verdict: String,
    /** PRESENT or LATE when verdict is OK */
    val attendance: String? = null,
    val message: String,
    val tokenAgeMs: Int? = null,
    val seq: Int? = null,
    val receivedAt: String? = null,
    val wifiOk: Boolean? = null,
    val intervalSec: Int? = null,
    val graceSec: Int? = null,
    val session: CheckinSession? = null,
    val module: CheckinModule? = null,
    val summary: CheckinSummary? = null,
)

/** One row of the phone's log for POST /attempts/bulk. */
@Serializable
data class AttemptUpload(
    val id: String,
    /** Only for attempts the server never received. */
    val verdict: String? = null,
    val reason: String? = null,
    val token: String? = null,
    val ssid: String? = null,
    val phoneLabel: String? = null,
    val distanceRow: String? = null,
    val distanceM: Double? = null,
    val role: String? = null,
    val runNo: Int? = null,
    val attemptNo: Int? = null,
    val firstFrameMs: Double? = null,
    val decodeMs: Double? = null,
    val framesProcessed: Int? = null,
    val framesDropped: Int? = null,
    val biometricMs: Double? = null,
    val postRttMs: Double? = null,
    val totalMs: Double? = null,
    val authMethod: String? = null,
    val androidSdk: Int? = null,
)

@Serializable
data class AttemptUploadRequest(val attempts: List<AttemptUpload>)

@Serializable
data class RejectedUpload(val id: String, val reason: String)

@Serializable
data class AttemptUploadResponse(val saved: List<String>, val rejected: List<RejectedUpload>)
