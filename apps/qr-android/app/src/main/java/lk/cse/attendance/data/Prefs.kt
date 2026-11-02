package lk.cse.attendance.data

import android.content.Context
import androidx.core.content.edit
import lk.cse.attendance.BuildConfig

/**
 * Small app settings in private storage. The refresh token is stored here too:
 * it only works together with this phone's Keystore key, and the lecturer can
 * revoke it with Reset device.
 */
class Prefs(context: Context) {
    private val sp = context.getSharedPreferences("cse_attendance", Context.MODE_PRIVATE)

    /** Fixed at build time (BuildConfig.SERVER_URL); a server saved by an older version is ignored. */
    val serverUrl: String
        get() = BuildConfig.SERVER_URL

    var deviceId: String?
        get() = sp.getString(KEY_DEVICE, null)
        set(value) = sp.edit { putString(KEY_DEVICE, value) }

    var refreshToken: String?
        get() = sp.getString(KEY_REFRESH, null)
        set(value) = sp.edit { putString(KEY_REFRESH, value) }

    /** How the key is unlocked: see [lk.cse.attendance.security.KeyUnlock]. */
    var keyUnlock: String?
        get() = sp.getString(KEY_UNLOCK, null)
        set(value) = sp.edit { putString(KEY_UNLOCK, value) }

    /** STRONGBOX, TEE or SOFTWARE, as sent to the server. */
    var keyLevel: String?
        get() = sp.getString(KEY_LEVEL, null)
        set(value) = sp.edit { putString(KEY_LEVEL, value) }

    /** "system", "light" or "dark". */
    var theme: String
        get() = sp.getString(KEY_THEME, null) ?: "system"
        set(value) = sp.edit { putString(KEY_THEME, value) }

    // ── Experiment settings (hidden screen, PLAN §5.1 item 7) ──────────────
    // Saved with every attempt while a phone label is set.

    var phoneLabel: String
        get() = sp.getString("exp.phoneLabel", null) ?: ""
        set(value) = sp.edit { putString("exp.phoneLabel", value.trim()) }

    /** FRONT, MIDDLE or BACK */
    var distanceRow: String
        get() = sp.getString("exp.distanceRow", null) ?: "FRONT"
        set(value) = sp.edit { putString("exp.distanceRow", value) }

    var distanceM: String
        get() = sp.getString("exp.distanceM", null) ?: ""
        set(value) = sp.edit { putString("exp.distanceM", value.trim()) }

    /** GENUINE or RELAY */
    var role: String
        get() = sp.getString("exp.role", null) ?: "GENUINE"
        set(value) = sp.edit { putString("exp.role", value) }

    var runNo: Int
        get() = sp.getInt("exp.runNo", 1)
        set(value) = sp.edit { putInt("exp.runNo", value) }

    /** Goes up by one after every attempt. */
    var nextAttemptNo: Int
        get() = sp.getInt("exp.nextAttemptNo", 1)
        set(value) = sp.edit { putInt("exp.nextAttemptNo", value) }

    /** No decode within this time gives NO_DECODE (default 20 s). */
    var scanTimeoutSec: Int
        get() = sp.getInt("exp.scanTimeoutSec", 20)
        set(value) = sp.edit { putInt("exp.scanTimeoutSec", value.coerceIn(5, 120)) }

    val labelsOn: Boolean get() = phoneLabel.isNotBlank()

    /** Forget this phone's registration (after Reset device or Set up again). */
    fun clearDevice() = sp.edit {
        remove(KEY_DEVICE)
        remove(KEY_REFRESH)
        remove(KEY_UNLOCK)
        remove(KEY_LEVEL)
    }

    private companion object {
        const val KEY_DEVICE = "deviceId"
        const val KEY_REFRESH = "refreshToken"
        const val KEY_UNLOCK = "keyUnlock"
        const val KEY_LEVEL = "keyLevel"
        const val KEY_THEME = "theme"
    }
}
