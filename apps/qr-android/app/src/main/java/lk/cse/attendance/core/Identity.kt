package lk.cse.attendance.core

/** Index numbers: 6 digits and a letter, upper case (e.g. 220366X). Same rule as the server. */
object Identity {
    private val INDEX = Regex("""^\d{6}[A-Z]$""")

    fun normaliseIndex(raw: String): String = raw.trim().uppercase()

    fun isValidIndex(raw: String): Boolean = INDEX.matches(normaliseIndex(raw))

    /** Tidies spacing; the server compares names ignoring case, spaces and dots. */
    fun cleanName(raw: String): String = raw.trim().replace(Regex("""\s+"""), " ")
}
