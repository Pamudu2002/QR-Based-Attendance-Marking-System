package lk.cse.attendance.ui

import java.time.Instant
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.util.Locale
import lk.cse.attendance.data.ApiException
import lk.cse.attendance.data.NeedsLoginException
import lk.cse.attendance.security.AuthCancelledException
import lk.cse.attendance.security.KeyInvalidatedException
import lk.cse.attendance.security.NoScreenLockException

// Server times are ISO 8601 UTC; show them in the phone's timezone.
private val zone get() = ZoneId.systemDefault()
private val day = DateTimeFormatter.ofPattern("EEE d MMM", Locale.UK)
private val time = DateTimeFormatter.ofPattern("HH:mm", Locale.UK)
private val longDay = DateTimeFormatter.ofPattern("EEEE d MMMM", Locale.UK)

fun parseInstant(iso: String): Instant = Instant.parse(iso)

/** Tue 3 Nov */
fun formatDay(iso: String): String = parseInstant(iso).atZone(zone).format(day)

/** 10:15 */
fun formatTime(iso: String): String = parseInstant(iso).atZone(zone).format(time)

/** Tuesday 3 November */
fun formatToday(): String = Instant.now().atZone(zone).format(longDay)

fun greeting(): String {
    val h = Instant.now().atZone(zone).hour
    return when {
        h < 12 -> "Good morning"
        h < 17 -> "Good afternoon"
        else -> "Good evening"
    }
}

/** A message for the student. Errors from the server already carry one. */
fun friendlyMessage(e: Throwable): String = when (e) {
    is ApiException -> e.message
    is NeedsLoginException, is AuthCancelledException, is KeyInvalidatedException, is NoScreenLockException -> e.message ?: "Try again."
    else -> "Something went wrong. Try again."
}
