package lk.cse.attendance.core

import javax.crypto.Mac
import javax.crypto.spec.SecretKeySpec

/**
 * The classroom beacon's Bluetooth LE advert (docs/PLAN.md §6.5), shared by the
 * beacon app (broadcasts it) and the student app (recognises it). Same bytes as
 * apps/backend/src/lib/beacon.ts:
 *
 *   manufacturer data, company ID 0xFFFF (reserved for testing)
 *   payload = "CA" | version 1 | seq (4, big-endian) | HMAC-SHA256(key, "B" | seq)[0..8]  → 15 bytes
 *   seq     = floor((server now − run start) / 5 s)
 */
object BeaconCode {
    const val COMPANY_ID = 0xFFFF
    const val ROTATE_SEC = 5
    const val PAYLOAD_BYTES = 15
    private const val VERSION: Byte = 1

    /** The fixed start of every payload, for scan filters: "C", "A", version. */
    val PREFIX = byteArrayOf(0x43, 0x41, VERSION)

    fun payload(key: ByteArray, seq: Long): ByteArray {
        val seqB = byteArrayOf((seq ushr 24).toByte(), (seq ushr 16).toByte(), (seq ushr 8).toByte(), seq.toByte())
        val mac = Mac.getInstance("HmacSHA256").apply { init(SecretKeySpec(key, "HmacSHA256")) }
        mac.update(byteArrayOf(0x42)) // "B"
        val tag = mac.doFinal(seqB).copyOf(8)
        return PREFIX + seqB + tag
    }

    fun seqAt(startedAtMs: Long, serverNowMs: Long): Long = ((serverNowMs - startedAtMs) / (ROTATE_SEC * 1000L)).coerceAtLeast(0)

    /** Looks like one of ours (the server checks the HMAC). */
    fun isBeacon(data: ByteArray?): Boolean =
        data != null && data.size == PAYLOAD_BYTES && data[0] == PREFIX[0] && data[1] == PREFIX[1] && data[2] == PREFIX[2]
}
