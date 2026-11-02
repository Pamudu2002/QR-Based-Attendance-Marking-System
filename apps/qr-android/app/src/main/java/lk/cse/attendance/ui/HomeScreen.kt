package lk.cse.attendance.ui

import androidx.compose.foundation.ExperimentalFoundationApi
import androidx.compose.foundation.clickable
import androidx.compose.foundation.combinedClickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.Home
import androidx.compose.material.icons.outlined.QrCodeScanner
import androidx.compose.material.icons.outlined.Settings
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.LifecycleResumeEffect
import kotlinx.coroutines.launch
import lk.cse.attendance.MainActivity
import lk.cse.attendance.core.AttendanceRule
import lk.cse.attendance.data.ApiException
import lk.cse.attendance.data.MeResponse
import lk.cse.attendance.data.ModuleSummary
import lk.cse.attendance.data.NeedsLoginException
import lk.cse.attendance.data.Session
import lk.cse.attendance.ui.theme.Lumora
import lk.cse.attendance.ui.theme.MonoText

/** Home / My modules (design/screens/AppHome.dc.html). */
@OptIn(ExperimentalFoundationApi::class)
@Composable
fun HomeScreen(
    session: Session,
    activity: MainActivity,
    onScan: () -> Unit,
    onModule: (String) -> Unit,
    onSettings: () -> Unit,
    onSetUpAgain: () -> Unit,
    onExperiment: () -> Unit,
    onUpload: () -> Unit,
) {
    val scope = rememberCoroutineScope()
    var me by remember { mutableStateOf<MeResponse?>(null) }
    var modules by remember { mutableStateOf<List<ModuleSummary>?>(null) }
    var needsLogin by remember { mutableStateOf(false) }
    var revoked by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }
    var reload by remember { mutableIntStateOf(0) }

    LifecycleResumeEffect(Unit) {
        reload++
        // Send any attempts still waiting on this phone (best effort).
        onUpload()
        onPauseOrDispose { }
    }
    LaunchedEffect(reload) {
        if (reload == 0) return@LaunchedEffect
        try {
            me = session.api.me()
            modules = session.api.modules().modules
            needsLogin = false
            error = null
        } catch (e: NeedsLoginException) {
            needsLogin = true
        } catch (e: ApiException) {
            if (e.isRevoked) revoked = true else error = e.message
        }
    }

    Scaffold(
        containerColor = Lumora.colors.surfaceSunken,
        bottomBar = {
            NavigationBar(containerColor = Lumora.colors.surface) {
                NavigationBarItem(selected = true, onClick = {}, icon = { Icon(Icons.Outlined.Home, null) }, label = { Text("Home") })
                NavigationBarItem(selected = false, onClick = onScan, icon = { Icon(Icons.Outlined.QrCodeScanner, null) }, label = { Text("Scan") })
                NavigationBarItem(selected = false, onClick = onSettings, icon = { Icon(Icons.Outlined.Settings, null) }, label = { Text("Settings") })
            }
        },
    ) { padding ->
        LazyColumn(
            modifier = Modifier.fillMaxSize().padding(padding),
            contentPadding = PaddingValues(start = 20.dp, end = 20.dp, top = 16.dp, bottom = 24.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp),
        ) {
            item {
                Column {
                    Text(formatToday(), style = MaterialTheme.typography.bodyMedium, color = Lumora.colors.inkMuted)
                    val first = me?.student?.name?.split(" ")?.firstOrNull()
                    // A long press opens the hidden experiment settings (PLAN §5.1 item 7).
                    Text(
                        if (first != null) "${greeting()}, $first" else greeting(),
                        style = MaterialTheme.typography.headlineSmall,
                        modifier = Modifier.combinedClickable(onClick = {}, onLongClick = onExperiment),
                    )
                }
            }

            when {
                revoked -> item {
                    Notice(Tone.Danger, "Your lecturer reset this phone, for example because you got a new one. Set up the app again.", lead = "This phone was reset.") {
                        SecondaryButton("Set up again", onClick = onSetUpAgain)
                    }
                }
                needsLogin -> item {
                    Notice(Tone.Info, "Unlock the app with your fingerprint or PIN to see your modules.") {
                        SecondaryButton("Confirm it's you", onClick = {
                            scope.launch {
                                try {
                                    session.logIn(activity)
                                    reload++
                                } catch (e: Exception) {
                                    error = friendlyMessage(e).takeUnless { e is lk.cse.attendance.security.AuthCancelledException }
                                }
                            }
                        })
                    }
                }
                modules == null && error == null -> item { Loading() }
            }
            error?.let { msg -> item { Notice(Tone.Danger, msg) } }

            val list = modules
            if (list != null && !revoked) {
                if (list.isEmpty()) {
                    item {
                        LuCard {
                            Text("Register for your first module", style = MaterialTheme.typography.titleMedium)
                            Text(
                                "In your first class, scan the registration QR on the projector and type your index number and name as on the class list.",
                                style = MaterialTheme.typography.bodyMedium,
                                color = Lumora.colors.inkMuted,
                            )
                            PrimaryButton("Scan the registration QR", onClick = onScan, icon = Icons.Outlined.QrCodeScanner, modifier = Modifier.padding(top = 8.dp))
                        }
                    }
                } else {
                    nextClass(list)?.let { (m, s) ->
                        item {
                            LuCard {
                                Row(verticalAlignment = Alignment.CenterVertically) {
                                    Text("Next class", style = MaterialTheme.typography.labelMedium, color = Lumora.colors.inkMuted, modifier = Modifier.weight(1f))
                                    StatusBadge(formatDay(s.startsAt), Tone.Brand)
                                }
                                Text(m.displayName.substringBefore(" - "), style = MonoText, color = Lumora.colors.inkMuted)
                                Text(s.title, style = MaterialTheme.typography.titleMedium)
                                Text("${formatTime(s.startsAt)} – ${formatTime(s.endsAt)} · ${s.venue}", style = MaterialTheme.typography.bodyMedium, color = Lumora.colors.inkMuted)
                                PrimaryButton("Scan", onClick = onScan, icon = Icons.Outlined.QrCodeScanner, modifier = Modifier.padding(top = 8.dp))
                            }
                        }
                    }

                    item { OverallStrip(list) }

                    list.filter { AttendanceRule.isBelow(it.attendancePct) }.forEach { m ->
                        item {
                            Notice(Tone.Warning, "You're at ${m.attendancePct}%. Attend every class you can.", lead = "${m.code} is below 80%.")
                        }
                    }

                    item {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Text("My modules", style = MaterialTheme.typography.titleSmall, modifier = Modifier.weight(1f))
                        }
                    }
                    items(list, key = { it.id }) { m -> ModuleRow(m, onClick = { onModule(m.id) }) }
                }
            }
        }
    }
}

private fun nextClass(list: List<ModuleSummary>) = list
    .mapNotNull { m -> m.nextSession?.let { m to it } }
    .minByOrNull { parseInstant(it.second.startsAt) }

@Composable
private fun OverallStrip(list: List<ModuleSummary>) {
    val past = list.sumOf { it.pastSessions }
    val attended = list.sumOf { it.attended }
    val pct = if (past > 0) attended * 100 / past else null
    LuCard {
        Row(horizontalArrangement = Arrangement.spacedBy(16.dp)) {
            Stat("Overall", pct?.let { "$it%" } ?: "–", Modifier.weight(1f))
            Stat("Attended", "$attended", Modifier.weight(1f))
            Stat("Missed", "${past - attended}", Modifier.weight(1f))
        }
    }
}

@Composable
private fun Stat(label: String, value: String, modifier: Modifier) {
    Column(modifier) {
        Text(label, style = MaterialTheme.typography.labelMedium, color = Lumora.colors.inkMuted)
        Text(value, style = MaterialTheme.typography.titleLarge)
    }
}

@Composable
private fun ModuleRow(m: ModuleSummary, onClick: () -> Unit) {
    val pct = m.attendancePct
    val low = pct != null && pct < 85
    LuCard(modifier = Modifier.clickable(onClick = onClick)) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Text("${m.code} · ${m.name}", style = MaterialTheme.typography.titleSmall, modifier = Modifier.weight(1f))
            Text(
                pct?.let { "$it%" } ?: "No classes yet",
                style = MaterialTheme.typography.titleSmall,
                color = if (low) Lumora.colors.warning else Lumora.colors.ink,
            )
        }
        Meter((pct ?: 0) / 100f, color = if (low) Lumora.colors.lumen else Lumora.colors.brand, modifier = Modifier.fillMaxWidth())
    }
}
