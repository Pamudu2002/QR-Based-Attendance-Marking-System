package lk.cse.attendance.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.outlined.ArrowBack
import androidx.compose.material.icons.outlined.Check
import androidx.compose.material.icons.outlined.Close
import androidx.compose.material.icons.outlined.Schedule
import androidx.compose.material.icons.outlined.WarningAmber
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.SegmentedButton
import androidx.compose.material3.SegmentedButtonDefaults
import androidx.compose.material3.SingleChoiceSegmentedButtonRow
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
import kotlinx.coroutines.launch
import lk.cse.attendance.MainActivity
import lk.cse.attendance.core.AttendanceRule
import lk.cse.attendance.data.ModuleDetailResponse
import lk.cse.attendance.data.NeedsLoginException
import lk.cse.attendance.data.SessionStatusItem
import lk.cse.attendance.data.Session
import lk.cse.attendance.ui.theme.Lumora

/** Module detail (design/screens/AppModule.dc.html). */
@Composable
fun ModuleScreen(session: Session, activity: MainActivity, moduleId: String, onBack: () -> Unit) {
    val scope = rememberCoroutineScope()
    var data by remember { mutableStateOf<ModuleDetailResponse?>(null) }
    var error by remember { mutableStateOf<String?>(null) }
    var needsLogin by remember { mutableStateOf(false) }
    var showUpcoming by remember { mutableStateOf(false) }
    var reload by remember { mutableIntStateOf(0) }

    LaunchedEffect(reload) {
        try {
            data = session.api.module(moduleId)
            needsLogin = false
        } catch (e: NeedsLoginException) {
            needsLogin = true
        } catch (e: Exception) {
            error = friendlyMessage(e)
        }
    }

    LazyColumn(
        modifier = Modifier.fillMaxSize().background(Lumora.colors.surfaceSunken).statusBarsPadding(),
        contentPadding = PaddingValues(start = 20.dp, end = 20.dp, top = 12.dp, bottom = 24.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp),
    ) {
        item {
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                IconButton(onClick = onBack) { Icon(Icons.AutoMirrored.Outlined.ArrowBack, contentDescription = "Back") }
                data?.let { StatusBadge(it.module.shortName, Tone.Neutral) }
            }
        }
        if (needsLogin) {
            item {
                Notice(Tone.Info, "Unlock the app with your fingerprint or PIN to continue.") {
                    SecondaryButton("Confirm it's you", onClick = {
                        scope.launch { runCatching { session.logIn(activity) }.onSuccess { reload++ } }
                    })
                }
            }
        }
        error?.let { item { Notice(Tone.Danger, it) } }

        val d = data
        if (d == null) {
            if (error == null && !needsLogin) item { Loading() }
            return@LazyColumn
        }

        item {
            Column {
                Text(d.module.name, style = MaterialTheme.typography.headlineSmall)
                val next = d.upcoming.firstOrNull()
                val detail = listOfNotNull(d.module.lecturer, next?.let { "Next: ${formatDay(it.startsAt)} ${formatTime(it.startsAt)} · ${it.venue}" })
                Text(detail.joinToString(" · "), style = MaterialTheme.typography.bodyMedium, color = Lumora.colors.inkMuted)
            }
        }

        item { Summary(d) }

        item {
            SingleChoiceSegmentedButtonRow(Modifier.fillMaxWidth()) {
                SegmentedButton(
                    selected = !showUpcoming,
                    onClick = { showUpcoming = false },
                    shape = SegmentedButtonDefaults.itemShape(0, 2),
                ) { Text("History") }
                SegmentedButton(
                    selected = showUpcoming,
                    onClick = { showUpcoming = true },
                    shape = SegmentedButtonDefaults.itemShape(1, 2),
                ) { Text("Upcoming ${d.upcoming.size}") }
            }
        }

        val rows = if (showUpcoming) d.upcoming else d.history
        if (rows.isEmpty()) {
            item {
                Text(
                    if (showUpcoming) "No upcoming classes." else "No classes yet.",
                    color = Lumora.colors.inkMuted,
                    style = MaterialTheme.typography.bodyMedium,
                )
            }
        } else {
            item {
                LuCard(padding = false) {
                    rows.forEachIndexed { i, s ->
                        if (i > 0) HorizontalDivider(color = Lumora.colors.line)
                        SessionRow(s)
                    }
                }
            }
        }
    }
}

@Composable
private fun Summary(d: ModuleDetailResponse) {
    val pct = d.attendancePct
    val left = AttendanceRule.missesLeft(d.attended, d.pastSessions, d.upcoming.size)
    LuCard {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(16.dp)) {
            Box(Modifier.size(88.dp), contentAlignment = Alignment.Center) {
                CircularProgressIndicator(
                    progress = { (pct ?: 0) / 100f },
                    modifier = Modifier.size(88.dp),
                    color = if (AttendanceRule.isBelow(pct)) Lumora.colors.warning else Lumora.colors.brand,
                    trackColor = Lumora.colors.surfaceSunken,
                    strokeWidth = 8.dp,
                )
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Text(pct?.let { "$it%" } ?: "–", style = MaterialTheme.typography.titleLarge)
                    Text("${d.attended} of ${d.pastSessions}", style = MaterialTheme.typography.labelSmall, color = Lumora.colors.inkMuted)
                }
            }
            Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                when {
                    pct == null -> StatusBadge("No classes yet", Tone.Neutral)
                    AttendanceRule.isBelow(pct) -> StatusBadge("Below 80%", Tone.Warning, Icons.Outlined.WarningAmber)
                    else -> StatusBadge("Above 80%", Tone.Success, Icons.Outlined.Check)
                }
                Text(
                    when {
                        left > 0 -> "You can miss $left more ${if (left == 1) "class" else "classes"} and stay above 80%."
                        left == 0 -> "Don't miss any more classes to stay above 80%."
                        else -> "You can't reach 80% in this module any more. Talk to your lecturer."
                    },
                    style = MaterialTheme.typography.bodyMedium,
                )
                Text("${d.upcoming.size} ${if (d.upcoming.size == 1) "class" else "classes"} left", style = MaterialTheme.typography.bodySmall, color = Lumora.colors.inkMuted)
            }
        }
    }
}

@Composable
private fun SessionRow(s: SessionStatusItem) {
    Row(
        Modifier.fillMaxWidth().padding(horizontal = 14.dp, vertical = 10.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        Column(Modifier.weight(1f)) {
            Text(s.title, style = MaterialTheme.typography.titleSmall)
            Text("${formatDay(s.startsAt)} · ${formatTime(s.startsAt)} · ${s.venue}", style = MaterialTheme.typography.bodySmall, color = Lumora.colors.inkMuted)
        }
        when (s.status) {
            "PRESENT" -> StatusBadge("Present", Tone.Success, Icons.Outlined.Check)
            "LATE" -> StatusBadge("Late", Tone.Warning, Icons.Outlined.Schedule)
            "EXCUSED" -> StatusBadge("Excused", Tone.Neutral)
            "ABSENT" -> StatusBadge("Absent", Tone.Danger, Icons.Outlined.Close)
            "NOT_YET" -> StatusBadge("Now", Tone.Brand)
            else -> StatusBadge("Upcoming", Tone.Neutral)
        }
    }
}
