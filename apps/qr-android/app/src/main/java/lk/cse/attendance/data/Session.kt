package lk.cse.attendance.data

import android.content.Context
import android.os.Build
import lk.cse.attendance.core.SignedMessages
import lk.cse.attendance.security.DeviceKey
import lk.cse.attendance.security.KeyUnlock
import lk.cse.attendance.security.UserAuth
import lk.cse.attendance.MainActivity

/** This phone's identity: the Keystore key, its deviceId on the server, and login. */
class Session(private val context: Context, val prefs: Prefs, val api: Api) {

    val deviceId: String? get() = prefs.deviceId

    val unlock: KeyUnlock
        get() = prefs.keyUnlock?.let { runCatching { KeyUnlock.valueOf(it) }.getOrNull() } ?: KeyUnlock.PER_USE

    val isSetUp: Boolean get() = prefs.deviceId != null && runCatching { DeviceKey.exists() }.getOrDefault(false)

    fun userAuth(activity: MainActivity) = UserAuth(activity, unlock)

    /**
     * First run: create the key, register the public key with the server, then
     * log in (one fingerprint/PIN check).
     */
    suspend fun setUp(activity: MainActivity) {
        prefs.clearDevice()
        api.forgetTokens()
        val created = DeviceKey.create(context)
        prefs.keyUnlock = created.unlock.name
        prefs.keyLevel = created.keyLevel

        val device = api.createDevice(
            CreateDeviceRequest(
                publicKey = DeviceKey.publicKeyBase64(),
                keyLevel = created.keyLevel,
                model = Build.MODEL.take(80),
                manufacturer = Build.MANUFACTURER.take(80),
                androidSdk = Build.VERSION.SDK_INT,
            ),
        )
        prefs.deviceId = device.deviceId
        logIn(activity)
    }

    /** Challenge–response login: sign "QRv1-LOGIN|deviceId|nonce" after a fingerprint/PIN check. */
    suspend fun logIn(activity: MainActivity) {
        val id = prefs.deviceId ?: throw IllegalStateException("Not set up")
        val challenge = api.challenge(id)
        val signed = userAuth(activity).sign(
            SignedMessages.login(id, challenge.nonce),
            title = "Confirm it's you",
            subtitle = "Unlock CSE Attendance on this phone",
        )
        api.verify(VerifyRequest(id, challenge.nonce, signed.signature))
    }

    /** Set up again from scratch: after Reset device, a broken key or a new phone owner. */
    fun reset() {
        runCatching { DeviceKey.delete() }
        api.forgetTokens()
        prefs.clearDevice()
    }
}
