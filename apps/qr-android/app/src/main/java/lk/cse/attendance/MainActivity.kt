package lk.cse.attendance

import android.app.Activity
import android.app.KeyguardManager
import android.os.Bundle
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.fragment.app.FragmentActivity
import kotlinx.coroutines.CompletableDeferred
import lk.cse.attendance.ui.AppNav
import lk.cse.attendance.ui.theme.CseAttendanceTheme

/** A FragmentActivity because BiometricPrompt needs one. */
class MainActivity : FragmentActivity() {

    private var pendingCredential: CompletableDeferred<Boolean>? = null
    private val credentialLauncher = registerForActivityResult(ActivityResultContracts.StartActivityForResult()) { result ->
        pendingCredential?.complete(result.resultCode == Activity.RESULT_OK)
        pendingCredential = null
    }

    /** "system", "light" or "dark", from Settings. */
    var theme by mutableStateOf("system")

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        val app = application as CseApp
        val session = app.session
        theme = session.prefs.theme
        setContent {
            val dark = when (theme) {
                "dark" -> true
                "light" -> false
                else -> isSystemInDarkTheme()
            }
            CseAttendanceTheme(darkTheme = dark) {
                AppNav(session = session, checkIns = app.checkIns, dao = app.db.attempts(), activity = this)
            }
        }
    }

    /** The PIN/pattern/password screen (Android 6–10 PIN-only phones). True if confirmed. */
    suspend fun confirmDeviceCredential(title: String, description: String): Boolean {
        val keyguard = getSystemService(KeyguardManager::class.java)
        @Suppress("DEPRECATION")
        val intent = keyguard.createConfirmDeviceCredentialIntent(title, description) ?: return false
        val result = CompletableDeferred<Boolean>()
        pendingCredential = result
        credentialLauncher.launch(intent)
        return result.await()
    }

    fun updateTheme(value: String) {
        theme = value
        (application as CseApp).session.prefs.theme = value
    }
}
