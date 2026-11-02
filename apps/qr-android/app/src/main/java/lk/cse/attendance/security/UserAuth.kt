package lk.cse.attendance.security

import android.os.Build
import android.os.SystemClock
import android.security.keystore.KeyPermanentlyInvalidatedException
import android.security.keystore.UserNotAuthenticatedException
import android.util.Base64
import androidx.biometric.BiometricManager.Authenticators.BIOMETRIC_STRONG
import androidx.biometric.BiometricManager.Authenticators.DEVICE_CREDENTIAL
import androidx.biometric.BiometricPrompt
import androidx.core.content.ContextCompat
import java.security.Signature
import kotlin.coroutines.resume
import kotlin.coroutines.resumeWithException
import kotlinx.coroutines.suspendCancellableCoroutine
import lk.cse.attendance.MainActivity

class AuthCancelledException : Exception("Cancelled.")

/** The key no longer works (e.g. a new fingerprint was added). The phone must be set up again. */
class KeyInvalidatedException : Exception("This phone's security key stopped working, for example after a new fingerprint was added. Set up the app again.")

/**
 * @param signature base64 DER (SHA256withECDSA)
 * @param authMethod BIOMETRIC, DEVICE_CREDENTIAL or DEVICE_CREDENTIAL_TIMED (logged with each attempt)
 * @param authNanos time from showing the prompt to the signature, from elapsedRealtimeNanos
 */
data class SignResult(val signature: String, val authMethod: String, val authNanos: Long)

/** Signs a message after a fingerprint, face or PIN check (docs/PLAN.md §6.4). */
class UserAuth(private val activity: MainActivity, private val unlock: KeyUnlock) {

    suspend fun sign(message: String, title: String, subtitle: String): SignResult {
        val bytes = message.toByteArray(Charsets.UTF_8)
        val started = SystemClock.elapsedRealtimeNanos()
        return when (unlock) {
            KeyUnlock.PER_USE -> signWithPrompt(bytes, title, subtitle, started)
            KeyUnlock.TIMED -> signAfterCredential(bytes, title, subtitle, started)
        }
    }

    private suspend fun signWithPrompt(bytes: ByteArray, title: String, subtitle: String, started: Long): SignResult {
        val signature = try {
            DeviceKey.newSignature()
        } catch (e: KeyPermanentlyInvalidatedException) {
            throw KeyInvalidatedException()
        }
        val info = BiometricPrompt.PromptInfo.Builder()
            .setTitle(title)
            .setSubtitle(subtitle)
            .apply {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                    setAllowedAuthenticators(BIOMETRIC_STRONG or DEVICE_CREDENTIAL)
                } else {
                    // Before Android 11 a CryptoObject only works with a strong biometric.
                    setAllowedAuthenticators(BIOMETRIC_STRONG)
                    setNegativeButtonText("Cancel")
                }
            }
            .build()

        return suspendCancellableCoroutine { cont ->
            val prompt = BiometricPrompt(activity, ContextCompat.getMainExecutor(activity), object : BiometricPrompt.AuthenticationCallback() {
                override fun onAuthenticationSucceeded(result: BiometricPrompt.AuthenticationResult) {
                    val unlocked = result.cryptoObject?.signature
                    if (unlocked == null) {
                        cont.resumeWithException(IllegalStateException("No signature from the prompt"))
                        return
                    }
                    val method = if (result.authenticationType == BiometricPrompt.AUTHENTICATION_RESULT_TYPE_DEVICE_CREDENTIAL) "DEVICE_CREDENTIAL" else "BIOMETRIC"
                    runCatching { encode(unlocked, bytes) }
                        .onSuccess { cont.resume(SignResult(it, method, SystemClock.elapsedRealtimeNanos() - started)) }
                        .onFailure { cont.resumeWithException(it) }
                }

                override fun onAuthenticationError(errorCode: Int, errString: CharSequence) {
                    val cancelled = errorCode == BiometricPrompt.ERROR_USER_CANCELED ||
                        errorCode == BiometricPrompt.ERROR_NEGATIVE_BUTTON ||
                        errorCode == BiometricPrompt.ERROR_CANCELED
                    cont.resumeWithException(if (cancelled) AuthCancelledException() else Exception(errString.toString()))
                }
                // onAuthenticationFailed: a finger didn't match; the prompt lets them try again.
            })
            prompt.authenticate(info, BiometricPrompt.CryptoObject(signature))
            cont.invokeOnCancellation { prompt.cancelAuthentication() }
        }
    }

    /** Android 6–10, PIN-only phones: confirm the device credential, then sign within 15 s. */
    private suspend fun signAfterCredential(bytes: ByteArray, title: String, subtitle: String, started: Long): SignResult {
        fun trySign(): String = try {
            encode(DeviceKey.newSignature(), bytes)
        } catch (e: KeyPermanentlyInvalidatedException) {
            throw KeyInvalidatedException()
        }

        // Always ask: a check-in must not ride on an unlock from a few seconds ago.
        if (!activity.confirmDeviceCredential(title, subtitle)) throw AuthCancelledException()
        val sig = try {
            trySign()
        } catch (e: UserNotAuthenticatedException) {
            throw AuthCancelledException()
        }
        return SignResult(sig, "DEVICE_CREDENTIAL_TIMED", SystemClock.elapsedRealtimeNanos() - started)
    }

    private fun encode(signature: Signature, bytes: ByteArray): String {
        signature.update(bytes)
        return Base64.encodeToString(signature.sign(), Base64.NO_WRAP)
    }
}
