package lk.cse.attendance.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.outlined.ArrowBack
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.SegmentedButton
import androidx.compose.material3.SegmentedButtonDefaults
import androidx.compose.material3.SingleChoiceSegmentedButtonRow
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import java.time.Instant
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.util.Locale
import kotlinx.coroutines.launch
import lk.cse.attendance.data.AttemptDao
import lk.cse.attendance.data.AttemptEntity
import lk.cse.attendance.data.CheckIns
import lk.cse.attendance.data.Session
import lk.cse.attendance.ui.theme.Lumora
import lk.cse.attendance.ui.theme.MonoText

@Composable
private fun BackTitle(title: String, onBack: () -> Unit, badge: (@Composable () -> Unit)? = null) {
    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        IconButton(onClick = onBack) { Icon(Icons.AutoMirrored.Outlined.ArrowBack, contentDescription = "Back") }
        Text(title, style = MaterialTheme.typography.titleMedium, modifier = Modifier.weight(1f))
        badge?.invoke()
    }
}

/** Shared upload notice: attempts waiting on this phone, with Upload now. */
@Composable
private fun UploadNotice(dao: AttemptDao, checkIns: CheckIns) {
    val scope = rememberCoroutineScope()
    val waiting by dao.pendingCount().collectAsState(initial = 0)
    var status by remember { mutableStateOf<String?>(null) }
    var busy by remember { mutableStateOf(false) }
    if (waiting == 0) {
        Notice(Tone.Success, status ?: "Every attempt is on the server.")
        return
    }
    Notice(Tone.Warning, "Saved on this phone. ${status ?: ""}", lead = "$waiting ${if (waiting == 1) "attempt" else "attempts"} waiting.") {
        SecondaryButton(if (busy) "Uploading…" else "Upload now", enabled = !busy, onClick = {
            busy = true
            scope.launch {
                status = try {
                    "Uploaded ${checkIns.upload()}."
                } catch (e: Exception) {
                    friendlyMessage(e)
                }
                busy = false
            }
        })
    }
}

/**
 * Experiment settings (design/screens/AppSettings.dc.html), opened by a long
 * press on the home title. The labels are saved with every check-in attempt.
 */
@Composable
fun ExperimentSettingsScreen(session: Session, dao: AttemptDao, checkIns: CheckIns, onBack: () -> Unit, onLog: () -> Unit) {
    val p = session.prefs
    var label by remember { mutableStateOf(p.phoneLabel) }
    var distance by remember { mutableStateOf(p.distanceM) }
    var row by remember { mutableStateOf(p.distanceRow) }
    var role by remember { mutableStateOf(p.role) }
    var run by remember { mutableStateOf(p.runNo.toString()) }
    var next by remember { mutableStateOf(p.nextAttemptNo.toString()) }
    var timeout by remember { mutableStateOf(p.scanTimeoutSec.toString()) }

    fun save() {
        p.phoneLabel = label
        p.distanceM = distance
        p.distanceRow = row
        p.role = role
        run.toIntOrNull()?.let { p.runNo = it }
        next.toIntOrNull()?.let { p.nextAttemptNo = it }
        timeout.toIntOrNull()?.let { p.scanTimeoutSec = it }
    }

    Column(
        Modifier
            .fillMaxSize()
            .background(Lumora.colors.surfaceSunken)
            .statusBarsPadding()
            .navigationBarsPadding()
            .imePadding()
            .verticalScroll(rememberScrollState())
            .padding(start = 20.dp, end = 20.dp, top = 12.dp, bottom = 24.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp),
    ) {
        BackTitle("Experiment settings", onBack = { save(); onBack() }) { StatusBadge("Hidden screen", Tone.Warning) }
        Notice(Tone.Info, "For the CS4473 experiment only. These labels are saved with every check-in attempt. Leave the phone label empty for normal use.")

        LuCard {
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                OutlinedTextField(label, { label = it }, label = { Text("Phone label") }, placeholder = { Text("P1-lowend") }, singleLine = true, modifier = Modifier.weight(1f))
                OutlinedTextField(distance, { distance = it }, label = { Text("Distance (m)") }, singleLine = true, keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal), modifier = Modifier.weight(1f))
            }
            Text("Seat row", style = MaterialTheme.typography.labelMedium, color = Lumora.colors.inkMuted, modifier = Modifier.padding(top = 8.dp))
            Segments(listOf("FRONT" to "Front", "MIDDLE" to "Middle", "BACK" to "Back"), row) { row = it }
            Text("Role", style = MaterialTheme.typography.labelMedium, color = Lumora.colors.inkMuted, modifier = Modifier.padding(top = 8.dp))
            Segments(listOf("GENUINE" to "Genuine", "RELAY" to "Relay"), role) { role = it }
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.padding(top = 8.dp)) {
                OutlinedTextField(run, { run = it.filter(Char::isDigit) }, label = { Text("Run") }, singleLine = true, keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number), modifier = Modifier.weight(1f))
                OutlinedTextField(next, { next = it.filter(Char::isDigit) }, label = { Text("Next attempt") }, singleLine = true, keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number), modifier = Modifier.weight(1f))
                OutlinedTextField(timeout, { timeout = it.filter(Char::isDigit) }, label = { Text("Timeout (s)") }, singleLine = true, keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number), modifier = Modifier.weight(1f))
            }
            PrimaryButton("Save", onClick = ::save, modifier = Modifier.padding(top = 8.dp))
        }

        UploadNotice(dao, checkIns)
        SecondaryButton("Attempt log", onClick = { save(); onLog() }, modifier = Modifier.fillMaxWidth())
    }
}

@Composable
private fun Segments(options: List<Pair<String, String>>, selected: String, onSelect: (String) -> Unit) {
    SingleChoiceSegmentedButtonRow(Modifier.fillMaxWidth()) {
        options.forEachIndexed { i, (value, text) ->
            SegmentedButton(selected = selected == value, onClick = { onSelect(value) }, shape = SegmentedButtonDefaults.itemShape(i, options.size)) { Text(text) }
        }
    }
}

private val logTime = DateTimeFormatter.ofPattern("d MMM HH:mm:ss", Locale.UK)

/** Attempts saved on this phone and whether they reached the server (PLAN §5.1 item 8). */
@Composable
fun AttemptLogScreen(dao: AttemptDao, checkIns: CheckIns, onBack: () -> Unit) {
    val attempts by dao.recent().collectAsState(initial = null)
    LazyColumn(
        modifier = Modifier.fillMaxSize().background(Lumora.colors.surfaceSunken).statusBarsPadding(),
        contentPadding = PaddingValues(start = 20.dp, end = 20.dp, top = 12.dp, bottom = 24.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        item { BackTitle("Attempt log", onBack) }
        item { UploadNotice(dao, checkIns) }
        val list = attempts
        when {
            list == null -> item { Loading() }
            list.isEmpty() -> item { Text("No attempts yet.", color = Lumora.colors.inkMuted) }
            else -> items(list, key = { it.id }) { AttemptRow(it) }
        }
    }
}

@Composable
private fun AttemptRow(a: AttemptEntity) {
    LuCard {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Text(Instant.ofEpochMilli(a.createdAtMs).atZone(ZoneId.systemDefault()).format(logTime), style = MonoText, modifier = Modifier.weight(1f))
            val tone = when (a.verdict) {
                "OK" -> Tone.Success
                "NO_DECODE", "CANCELLED", "PENDING", "DUPLICATE" -> Tone.Neutral
                "NETWORK_ERROR" -> Tone.Warning
                else -> Tone.Danger
            }
            StatusBadge(if (a.verdict == "OK") (a.attendance ?: "OK") else a.verdict, tone)
        }
        val parts = listOfNotNull(
            a.phoneLabel?.let { "$it · run ${a.runNo} · #${a.attemptNo}" },
            a.totalMs?.let { "total ${"%.1f".format(Locale.UK, it / 1000)} s" },
            a.tokenAgeMs?.let { "code age ${"%.1f".format(Locale.UK, it / 1000.0)} s" },
        )
        if (parts.isNotEmpty()) Text(parts.joinToString(" · "), style = MaterialTheme.typography.bodySmall, color = Lumora.colors.inkMuted)
        a.reason?.takeIf { a.verdict != "OK" }?.let { Text(it, style = MaterialTheme.typography.bodySmall, color = Lumora.colors.inkMuted) }
        Text(if (a.uploaded) "On the server" else "Waiting to upload", style = MaterialTheme.typography.labelSmall, color = if (a.uploaded) Lumora.colors.success else Lumora.colors.warning)
    }
}
