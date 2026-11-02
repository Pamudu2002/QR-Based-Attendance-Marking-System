package lk.cse.attendance.core

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class QrPayloadTest {
    private val token = "Cr0gcGDfQyA_ynrnplcu5gAAAC91b3XB69SfWBh1zbbfpVrn"

    @Test fun readsBothKinds() {
        assertEquals(QrPayload.Registration(token), QrPayload.parse("QA1:R:$token"))
        assertEquals(QrPayload.CheckIn(token), QrPayload.parse(" QA1:C:$token\n"))
        assertEquals("QA1:R:$token", QrPayload.Registration(token).text)
    }

    @Test fun rejectsOtherCodes() {
        assertNull(QrPayload.parse("https://example.com"))
        assertNull(QrPayload.parse("QA1:R:short"))
        assertNull(QrPayload.parse("QA1:X:$token"))
        assertNull(QrPayload.parse("QA1:R:${token}!"))
    }
}
