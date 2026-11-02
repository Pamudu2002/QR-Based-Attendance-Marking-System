package lk.cse.attendance.core

/**
 * What a scanned QR means (docs/PLAN.md §6.2). One Scan button handles both kinds:
 *   QA1:R:<token>  registration for a module
 *   QA1:C:<token>  check-in to a class
 * `token` is the 48-character part after the prefix; it's what gets signed.
 */
sealed interface QrPayload {
    val token: String

    /** The full QR text, as sent to the server. */
    val text: String

    data class Registration(override val token: String) : QrPayload {
        override val text get() = REG_PREFIX + token
    }

    data class CheckIn(override val token: String) : QrPayload {
        override val text get() = CHECKIN_PREFIX + token
    }

    companion object {
        const val REG_PREFIX = "QA1:R:"
        const val CHECKIN_PREFIX = "QA1:C:"
        private val TOKEN = Regex("^[A-Za-z0-9_-]{48}$")

        /** Null if the text isn't a CSE Attendance code. */
        fun parse(text: String): QrPayload? {
            val t = text.trim()
            val token = when {
                t.startsWith(REG_PREFIX) -> t.removePrefix(REG_PREFIX)
                t.startsWith(CHECKIN_PREFIX) -> t.removePrefix(CHECKIN_PREFIX)
                else -> return null
            }
            if (!TOKEN.matches(token)) return null
            return if (t.startsWith(REG_PREFIX)) Registration(token) else CheckIn(token)
        }
    }
}
