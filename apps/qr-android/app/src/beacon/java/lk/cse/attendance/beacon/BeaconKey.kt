package lk.cse.attendance.beacon

import android.content.Context
import android.content.pm.PackageManager
import android.os.Build
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyInfo
import android.security.keystore.KeyProperties
import android.util.Base64
import java.security.KeyFactory
import java.security.KeyPairGenerator
import java.security.KeyStore
import java.security.PrivateKey
import java.security.Signature
import java.security.spec.ECGenParameterSpec

/**
 * The beacon phone's EC P-256 Keystore key. Unlike the student key it needs no
 * fingerprint: the phone logs in by itself while it sits on the desk. It only
 * proves "this is the linked beacon phone"; the lecturer can remove it any time.
 */
object BeaconKey {
    private const val ALIAS = "cse_attendance_beacon_key"
    private const val KEYSTORE = "AndroidKeyStore"

    private fun keyStore() = KeyStore.getInstance(KEYSTORE).apply { load(null) }

    fun exists(): Boolean = keyStore().containsAlias(ALIAS)

    fun delete() = keyStore().deleteEntry(ALIAS)

    /** A new key (StrongBox when the phone has it, else the TEE). Returns its key level. */
    fun create(context: Context): String {
        delete()
        val strongBox = Build.VERSION.SDK_INT >= Build.VERSION_CODES.P &&
            context.packageManager.hasSystemFeature(PackageManager.FEATURE_STRONGBOX_KEYSTORE) &&
            runCatching { generate(strongBox = true) }.isSuccess
        if (!strongBox) generate(strongBox = false)
        return level(strongBox)
    }

    private fun generate(strongBox: Boolean) {
        val spec = KeyGenParameterSpec.Builder(ALIAS, KeyProperties.PURPOSE_SIGN)
            .setAlgorithmParameterSpec(ECGenParameterSpec("secp256r1"))
            .setDigests(KeyProperties.DIGEST_SHA256)
            .apply { if (strongBox && Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) setIsStrongBoxBacked(true) }
            .build()
        KeyPairGenerator.getInstance(KeyProperties.KEY_ALGORITHM_EC, KEYSTORE).apply {
            initialize(spec)
            generateKeyPair()
        }
    }

    private fun privateKey(): PrivateKey = keyStore().getKey(ALIAS, null) as? PrivateKey ?: throw IllegalStateException("No beacon key")

    private fun level(createdInStrongBox: Boolean): String {
        val key = privateKey()
        val info = KeyFactory.getInstance(key.algorithm, KEYSTORE).getKeySpec(key, KeyInfo::class.java)
        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            when (info.securityLevel) {
                KeyProperties.SECURITY_LEVEL_STRONGBOX -> "STRONGBOX"
                KeyProperties.SECURITY_LEVEL_TRUSTED_ENVIRONMENT, KeyProperties.SECURITY_LEVEL_UNKNOWN_SECURE -> "TEE"
                else -> "SOFTWARE"
            }
        } else {
            @Suppress("DEPRECATION")
            when {
                !info.isInsideSecureHardware -> "SOFTWARE"
                createdInStrongBox -> "STRONGBOX"
                else -> "TEE"
            }
        }
    }

    fun publicKeyBase64(): String = Base64.encodeToString(keyStore().getCertificate(ALIAS).publicKey.encoded, Base64.NO_WRAP)

    /** SHA256withECDSA, DER, base64 (as the server expects). */
    fun sign(message: String): String {
        val sig = Signature.getInstance("SHA256withECDSA").apply {
            initSign(privateKey())
            update(message.toByteArray(Charsets.UTF_8))
        }
        return Base64.encodeToString(sig.sign(), Base64.NO_WRAP)
    }
}
