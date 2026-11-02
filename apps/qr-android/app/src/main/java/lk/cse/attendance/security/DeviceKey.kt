package lk.cse.attendance.security

import android.app.KeyguardManager
import android.content.Context
import android.content.pm.PackageManager
import android.os.Build
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyInfo
import android.security.keystore.KeyProperties
import android.security.keystore.StrongBoxUnavailableException
import android.util.Base64
import androidx.annotation.RequiresApi
import androidx.biometric.BiometricManager
import androidx.biometric.BiometricManager.Authenticators.BIOMETRIC_STRONG
import java.security.KeyFactory
import java.security.KeyPairGenerator
import java.security.KeyStore
import java.security.PrivateKey
import java.security.Signature
import java.security.spec.ECGenParameterSpec

/**
 * How the key is unlocked (docs/PLAN.md §6.4):
 * - [PER_USE]: every signature needs a fingerprint/face (Android 6–10) or a
 *   fingerprint/face/PIN (Android 11+) through BiometricPrompt with a CryptoObject.
 * - [TIMED]: Android 6–10 phones with only a PIN/pattern/password. The key is
 *   usable for 15 s after the device credential screen.
 */
enum class KeyUnlock { PER_USE, TIMED }

class NoScreenLockException : Exception("Set a screen lock (PIN, pattern, password or fingerprint) on this phone first.")

/** EC P-256 signing key in the Android Keystore, bound to the user's screen lock. */
object DeviceKey {
    private const val ALIAS = "cse_attendance_device_key"
    private const val KEYSTORE = "AndroidKeyStore"
    const val TIMED_VALIDITY_SEC = 15

    data class Created(val unlock: KeyUnlock, val keyLevel: String)

    private fun keyStore() = KeyStore.getInstance(KEYSTORE).apply { load(null) }

    fun exists(): Boolean = keyStore().containsAlias(ALIAS)

    fun delete() {
        keyStore().deleteEntry(ALIAS)
    }

    /** Creates a new key, replacing any old one. StrongBox when the phone has it, else the TEE. */
    fun create(context: Context): Created {
        val keyguard = context.getSystemService(KeyguardManager::class.java)
        if (!keyguard.isDeviceSecure) throw NoScreenLockException()

        val unlock = when {
            Build.VERSION.SDK_INT >= Build.VERSION_CODES.R -> KeyUnlock.PER_USE
            BiometricManager.from(context).canAuthenticate(BIOMETRIC_STRONG) == BiometricManager.BIOMETRIC_SUCCESS -> KeyUnlock.PER_USE
            else -> KeyUnlock.TIMED
        }
        delete()

        val wantStrongBox = Build.VERSION.SDK_INT >= Build.VERSION_CODES.P &&
            context.packageManager.hasSystemFeature(PackageManager.FEATURE_STRONGBOX_KEYSTORE)
        val strongBox = wantStrongBox && tryStrongBox(unlock)
        if (!strongBox) generate(unlock, strongBox = false)

        return Created(unlock, keyLevel(createdInStrongBox = strongBox))
    }

    /** Some phones list StrongBox but can't make this key there; fall back to the TEE. */
    @RequiresApi(Build.VERSION_CODES.P)
    private fun tryStrongBox(unlock: KeyUnlock): Boolean = try {
        generate(unlock, strongBox = true)
        true
    } catch (e: StrongBoxUnavailableException) {
        false
    } catch (e: Exception) {
        if (e.cause is StrongBoxUnavailableException) false else throw e
    }

    private fun generate(unlock: KeyUnlock, strongBox: Boolean) {
        val spec = KeyGenParameterSpec.Builder(ALIAS, KeyProperties.PURPOSE_SIGN)
            .setAlgorithmParameterSpec(ECGenParameterSpec("secp256r1"))
            .setDigests(KeyProperties.DIGEST_SHA256)
            .setUserAuthenticationRequired(true)
            .apply {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                    // 0 = every use needs a fresh check; fingerprint, face or PIN.
                    setUserAuthenticationParameters(0, KeyProperties.AUTH_BIOMETRIC_STRONG or KeyProperties.AUTH_DEVICE_CREDENTIAL)
                } else {
                    @Suppress("DEPRECATION")
                    setUserAuthenticationValidityDurationSeconds(if (unlock == KeyUnlock.PER_USE) -1 else TIMED_VALIDITY_SEC)
                }
                if (strongBox && Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) setIsStrongBoxBacked(true)
            }
            .build()
        KeyPairGenerator.getInstance(KeyProperties.KEY_ALGORITHM_EC, KEYSTORE).apply {
            initialize(spec)
            generateKeyPair()
        }
    }

    private fun privateKey(): PrivateKey =
        keyStore().getKey(ALIAS, null) as? PrivateKey ?: throw IllegalStateException("No device key")

    /** The real key level from KeyInfo (STRONGBOX, TEE or SOFTWARE). */
    fun keyLevel(createdInStrongBox: Boolean = false): String {
        val key = privateKey()
        val info = KeyFactory.getInstance(key.algorithm, KEYSTORE).getKeySpec(key, KeyInfo::class.java)
        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            when (info.securityLevel) {
                KeyProperties.SECURITY_LEVEL_STRONGBOX -> "STRONGBOX"
                KeyProperties.SECURITY_LEVEL_TRUSTED_ENVIRONMENT, KeyProperties.SECURITY_LEVEL_UNKNOWN_SECURE -> "TEE"
                else -> "SOFTWARE"
            }
        } else {
            // Before Android 12, KeyInfo can't tell StrongBox from the TEE.
            @Suppress("DEPRECATION")
            when {
                !info.isInsideSecureHardware -> "SOFTWARE"
                createdInStrongBox -> "STRONGBOX"
                else -> "TEE"
            }
        }
    }

    /** X.509 SubjectPublicKeyInfo DER, base64, for POST /devices. */
    fun publicKeyBase64(): String {
        val cert = keyStore().getCertificate(ALIAS) ?: throw IllegalStateException("No device key")
        return Base64.encodeToString(cert.publicKey.encoded, Base64.NO_WRAP)
    }

    /** A signature object ready to be unlocked. May throw KeyPermanentlyInvalidatedException. */
    fun newSignature(): Signature = Signature.getInstance("SHA256withECDSA").apply { initSign(privateKey()) }
}
