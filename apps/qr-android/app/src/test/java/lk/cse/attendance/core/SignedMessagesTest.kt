package lk.cse.attendance.core

import org.junit.Assert.assertEquals
import org.junit.Test

/** Same strings as apps/backend/src/lib/device-crypto.test.ts. */
class SignedMessagesTest {
    @Test fun matchesTheServer() {
        assertEquals("QRv1-REG|TOKEN|dev1|220366X", SignedMessages.registration("TOKEN", "dev1", "220366X"))
        assertEquals("QRv1-LOGIN|dev1|n", SignedMessages.login("dev1", "n"))
        assertEquals("QRv1-CHK|TOKEN|dev1|a1", SignedMessages.checkIn("TOKEN", "dev1", "a1"))
    }
}
