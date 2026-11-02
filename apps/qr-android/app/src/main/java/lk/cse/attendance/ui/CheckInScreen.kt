package lk.cse.attendance.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.Check
import androidx.compose.material.icons.outlined.Close
import androidx.compose.material.icons.outlined.Schedule
import androidx.compose.material.icons.outlined.WifiOff
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import java.time.Instant
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.util.Locale
import kotlinx.coroutines.launch
import lk.cse.attendance.MainActivity
import lk.cse.attendance.data.CheckInOutcome
import lk.cse.attendance.data.CheckIns
import lk.cse.attendance.data.Session
import lk.cse.attendance.ui.theme.Lumora
import lk.cse.attendance.ui.theme.MonoText

/**
 * Runs the check-in for the code the scanner just read (fingerprint/PIN → signed
 * POST) and shows the result (design/screens/AppResult.dc.html).
 */
@Composable
fun CheckInScreen(
    session: Session,
    checkIns: CheckIns,
    activity: MainActivity,
    onDone: () -> Unit,
    onScanAgain: () -> Unit,
    onModule: (String) -> Unit,
    onSetUpAgain: () -> Unit,
) {
    val scope = rememberCoroutineScope()
    var outcome by remember { mutableStateOf<CheckInOutcome?>(null) }
    var busy by remember { mutableStateOf(true) }
    val experiment = session.prefs.labelsOn

    LaunchedEffect(Unit) {
        val scan = checkIns.pending
        checkIns.pending = null
        outcome = if (scan == null) CheckInOutcome.Failed("Scan the code on the projector again.") else checkIns.run(activity, scan)
        busy = false
    }

    Column(
        Modifier
            .fillMaxSize()
            .background(Lumora.colors.surface)
            .statusBarsPadding()
            .navigationBarsPadding()
            .verticalScroll(rememberScrollState())
            .padding(start = 20.dp, end = 20.dp, top = 32.dp, bottom = 24.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp),
    ) {
        when (val o = outcome) {
            null -> {
                Loading()
                Text("Confirm with your fingerprint or PIN", style = MaterialTheme.typography.titleMedium, textAlign = TextAlign.Center, modifier = Modifier.fillMaxWidth())
            }
            is CheckInOutcome.Done -> ResultView(o, experiment, onDone, onScanAgain, onModule)
            is CheckInOutcome.Cancelled -> {
                Hero(Icons.Outlined.Close, Tone.Neutral, "Not checked in")
                Notice(Tone.Info, "You cancelled the fingerprint or PIN check. Scan the code again to check in.")
                PrimaryButton("Scan again", onClick = onScanAgain)
                SecondaryButton("Done", onClick = onDone, modifier = Modifier.fillMaxWidth())
            }
            is CheckInOutcome.NoReply -> {
                Hero(Icons.Outlined.WifiOff, Tone.Warning, "No reply from the server")
                Notice(Tone.Warning, "${o.message} Your check-in is saved on this phone. Send it again now; if the code has changed by then, scan again.")
                PrimaryButton("Send again", busy = busy, onClick = {
                    busy = true
                    scope.launch {
                        outcome = checkIns.retry()
                        busy = false
                    }
                })
                SecondaryButton("Scan again", onClick = onScanAgain, modifier = Modifier.fillMaxWidth())
            }
            is CheckInOutcome.Failed -> {
                Hero(Icons.Outlined.Close, Tone.Danger, "Not checked in")
                Notice(Tone.Danger, o.message)
                if (o.setUpAgain) PrimaryButton("Set up again", onClick = onSetUpAgain) else PrimaryButton("Scan again", onClick = onScanAgain)
                SecondaryButton("Done", onClick = onDone, modifier = Modifier.fillMaxWidth())
            }
        }
    }
}

@Composable
private fun Hero(icon: ImageVector, tone: Tone, title: String, badge: (@Composable () -> Unit)? = null) {
    val c = Lumora.colors
    val (fg, bg) = when (tone) {
        Tone.Success -> c.success to c.successSoft
        Tone.Warning -> c.warning to c.warningSoft
        Tone.Danger -> c.danger to c.dangerSoft
        else -> c.inkMuted to c.surfaceSunken
    }
    Column(Modifier.fillMaxWidth(), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(10.dp)) {
        Box(Modifier.size(72.dp).background(bg, CircleShape), contentAlignment = Alignment.Center) {
            Icon(icon, contentDescription = null, tint = fg, modifier = Modifier.size(36.dp))
        }
        Text(title, style = MaterialTheme.typography.headlineSmall, textAlign = TextAlign.Center)
        badge?.invoke()
    }
}

private val clock = DateTimeFormatter.ofPattern("HH:mm:ss", Locale.UK)

@Composable
private fun ResultView(
    o: CheckInOutcome.Done,
    experiment: Boolean,
    onDone: () -> Unit,
    onScanAgain: () -> Unit,
    onModule: (String) -> Unit,
) {
    val r = o.response
    val ok = r.verdict == "OK"
    val late = r.attendance == "LATE"
    val at = r.receivedAt?.let { Instant.parse(it).atZone(ZoneId.systemDefault()).format(clock) } ?: ""

    when {
        ok && late -> Hero(Icons.Outlined.Schedule, Tone.Warning, "You're checked in, late") { StatusBadge("Late · $at", Tone.Warning, Icons.Outlined.Schedule) }
        ok -> Hero(Icons.Outlined.Check, Tone.Success, "You're checked in") { StatusBadge("Present · $at", Tone.Success, Icons.Outlined.Check) }
        r.verdict == "DUPLICATE" -> Hero(Icons.Outlined.Check, Tone.Neutral, "Already checked in")
        else -> Hero(Icons.Outlined.Close, Tone.Danger, "Not checked in") { StatusBadge(verdictLabel(r.verdict), Tone.Danger, Icons.Outlined.Close) }
    }

    if (!ok) Notice(if (r.verdict == "DUPLICATE") Tone.Info else Tone.Danger, r.message)

    r.module?.let { m ->
        LuCard {
            Text(m.displayName, style = MonoText, color = Lumora.colors.inkMuted)
            r.session?.let { s ->
                Text(s.title, style = MaterialTheme.typography.titleMedium)
                Text("${formatDay(s.startsAt)} · ${formatTime(s.startsAt)} – ${formatTime(s.endsAt)} · ${s.venue}", style = MaterialTheme.typography.bodyMedium, color = Lumora.colors.inkMuted)
            }
        }
    }

    // Check-in details (always shown: they are the experiment's measurements).
    LuCard {
        Text("Check-in details", style = MaterialTheme.typography.titleSmall)
        val window = if (r.intervalSec != null && r.graceSec != null) " of ${r.intervalSec + r.graceSec} s" else ""
        Detail("Code read by camera", seconds(o.timings.decodeMs))
        Detail("Fingerprint or PIN", seconds(o.timings.biometricMs))
        Detail("Server reply", seconds(o.timings.postRttMs))
        Detail("Code age at server", r.tokenAgeMs?.let { seconds(it.toDouble()) + window } ?: "–")
        if (experiment) {
            Detail("Total", seconds(o.timings.totalMs))
            Detail("Frames read", "${o.timings.framesProcessed}")
        }
        Row(Modifier.fillMaxWidth().padding(top = 2.dp), verticalAlignment = Alignment.CenterVertically) {
            Text("Classroom beacon", style = MaterialTheme.typography.bodyMedium, color = Lumora.colors.inkMuted, modifier = Modifier.weight(1f))
            when (r.beaconOk) {
                true -> StatusBadge("Heard", Tone.Success, Icons.Outlined.Check)
                false -> StatusBadge("Not current", Tone.Warning)
                null -> Text("Not heard", style = MaterialTheme.typography.bodyMedium)
            }
        }
    }

    r.summary?.let { sm ->
        if (ok && sm.attendancePct != null && r.module != null) {
            Notice(Tone.Info, "Your ${r.module.code} attendance is now ${sm.attendancePct}% (${sm.attended} of ${sm.pastSessions}).")
        }
    }

    PrimaryButton(if (experiment) "Scan again" else "Done", onClick = if (experiment) onScanAgain else onDone)
    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
        if (experiment) TextButton(onClick = onDone) { Text("Done") }
        r.module?.let { m -> TextButton(onClick = { onModule(m.id) }) { Text("See my attendance") } }
        if (!experiment && !ok && r.verdict != "DUPLICATE") TextButton(onClick = onScanAgain) { Text("Scan again") }
    }
}

@Composable
private fun Detail(label: String, value: String) {
    Column {
        Row(Modifier.fillMaxWidth().padding(vertical = 4.dp)) {
            Text(label, style = MaterialTheme.typography.bodyMedium, color = Lumora.colors.inkMuted, modifier = Modifier.weight(1f))
            Text(value, style = MonoText.copy(color = Color.Unspecified))
        }
        HorizontalDivider(color = Lumora.colors.line)
    }
}

private fun seconds(ms: Double) = String.format(Locale.UK, "%.1f s", ms / 1000.0)

private fun verdictLabel(v: String) = when (v) {
    "EXPIRED" -> "Code expired"
    "BAD_TOKEN" -> "Not a class code"
    "BAD_SIGNATURE" -> "Phone not verified"
    "NO_BEACON" -> "Beacon not found"
    "UNKNOWN_DEVICE" -> "Not registered"
    "DEVICE_REVOKED" -> "Phone was reset"
    "NOT_REGISTERED" -> "Not registered"
    "OUTSIDE_TIME" -> "Check-in closed"
    else -> "Rejected"
}
