package lk.cse.attendance.core

/** The 80% attendance rule, counted over all of a module's sessions. */
object AttendanceRule {
    const val THRESHOLD_PCT = 80

    /**
     * How many more classes the student can miss and still end at 80% or more.
     * Negative means they can no longer reach 80%.
     */
    fun missesLeft(attended: Int, past: Int, upcoming: Int): Int {
        val total = past + upcoming
        val maxMisses = total * (100 - THRESHOLD_PCT) / 100
        val missed = past - attended
        return maxMisses - missed
    }

    fun isBelow(pct: Int?): Boolean = pct != null && pct < THRESHOLD_PCT
}
