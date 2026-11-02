package lk.cse.attendance.core

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

/** Same test values as apps/backend/src/lib/beacon.test.ts: phone and server must agree byte for byte. */
class BeaconCodeTest {
    private fun hex(s: String) = s.chunked(2).map { it.toInt(16).toByte() }.toByteArray()
    private fun ByteArray.hex() = joinToString("") { "%02x".format(it) }

    // key = HMAC-SHA256("test-window-secret", "QA1-BEACON-KEY"), as the server sends it
    private val key = hex("be17f4759963e2827e4d71f98600e440a9d9865c16724226c23d717280dcfd70")

    @Test fun matchesTheServer() {
        assertEquals("43410100000007f5c07d2ee82175d7", BeaconCode.payload(key, 7).hex())
    }

    @Test fun countsFiveSecondSteps() {
        assertEquals(0, BeaconCode.seqAt(1_000, 5_999))
        assertEquals(7, BeaconCode.seqAt(1_000, 36_000))
        assertEquals(0, BeaconCode.seqAt(10_000, 9_000))
    }

    @Test fun recognisesOurAdverts() {
        assertTrue(BeaconCode.isBeacon(BeaconCode.payload(key, 1)))
        assertFalse(BeaconCode.isBeacon(hex("4c000215")))
        assertFalse(BeaconCode.isBeacon(null))
    }
}
