package lk.cse.attendance.core

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class RulesTest {
    @Test fun missesLeft() {
        // 8 of 8 so far, 4 to go: 12 in total, 2 may be missed.
        assertEquals(2, AttendanceRule.missesLeft(attended = 8, past = 8, upcoming = 4))
        assertEquals(0, AttendanceRule.missesLeft(attended = 6, past = 8, upcoming = 2))
        assertEquals(-1, AttendanceRule.missesLeft(attended = 5, past = 8, upcoming = 2))
    }

    @Test fun indexNumbers() {
        assertTrue(Identity.isValidIndex(" 220366x "))
        assertFalse(Identity.isValidIndex("22O366X"))
        assertEquals("220366X", Identity.normaliseIndex("220366x"))
        assertEquals("Lokuhewa P. C.", Identity.cleanName("  Lokuhewa   P. C. "))
    }
}
