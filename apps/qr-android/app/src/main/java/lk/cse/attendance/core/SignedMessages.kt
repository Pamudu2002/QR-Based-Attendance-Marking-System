package lk.cse.attendance.core

/**
 * The messages the Keystore key signs (SHA256withECDSA, UTF-8). They must match
 * the server byte for byte: apps/backend/src/lib/device-crypto.ts.
 */
object SignedMessages {
    fun login(deviceId: String, nonce: String) = join("QRv1-LOGIN", deviceId, nonce)

    fun registration(token: String, deviceId: String, indexNumber: String) =
        join("QRv1-REG", token, deviceId, indexNumber)

    fun checkIn(token: String, deviceId: String, attemptId: String) = join("QRv1-CHK", token, deviceId, attemptId)

    private fun join(vararg parts: String) = parts.joinToString("|")
}
