package lk.cse.attendance.ui

import android.os.Build
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.outlined.ArrowBack
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.SegmentedButton
import androidx.compose.material3.SegmentedButtonDefaults
import androidx.compose.material3.SingleChoiceSegmentedButtonRow
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import lk.cse.attendance.BuildConfig
import lk.cse.attendance.MainActivity
import lk.cse.attendance.data.Session
import lk.cse.attendance.security.KeyUnlock
import lk.cse.attendance.ui.theme.Lumora
import lk.cse.attendance.ui.theme.MonoText

@Composable
fun SettingsScreen(session: Session, activity: MainActivity, onBack: () -> Unit, onLog: () -> Unit, onSetUpAgain: () -> Unit) {
    val prefs = session.prefs
    var confirmReset by remember { mutableStateOf(false) }

    Column(
        Modifier
            .fillMaxSize()
            .background(Lumora.colors.surfaceSunken)
            .statusBarsPadding()
            .navigationBarsPadding()
            .verticalScroll(rememberScrollState())
            .padding(start = 20.dp, end = 20.dp, top = 12.dp, bottom = 24.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp),
    ) {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            IconButton(onClick = onBack) { Icon(Icons.AutoMirrored.Outlined.ArrowBack, contentDescription = "Back") }
            Text("Settings", style = MaterialTheme.typography.titleMedium)
        }

        LuCard {
            Text("Appearance", style = MaterialTheme.typography.titleSmall)
            val options = listOf("system" to "Phone setting", "light" to "Light", "dark" to "Dark")
            SingleChoiceSegmentedButtonRow(Modifier.fillMaxWidth()) {
                options.forEachIndexed { i, (value, label) ->
                    SegmentedButton(
                        selected = activity.theme == value,
                        onClick = { activity.updateTheme(value) },
                        shape = SegmentedButtonDefaults.itemShape(i, options.size),
                    ) { Text(label) }
                }
            }
        }

        LuCard {
            Text("This phone", style = MaterialTheme.typography.titleSmall)
            InfoRow("Device", session.deviceId ?: "Not set up")
            InfoRow("Key", prefs.keyLevel ?: "–")
            InfoRow(
                "Unlock",
                when (session.unlock) {
                    KeyUnlock.PER_USE -> if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) "Fingerprint, face or PIN each time" else "Fingerprint each time"
                    KeyUnlock.TIMED -> "PIN, pattern or password"
                },
            )
            InfoRow("Android", "${Build.VERSION.RELEASE} (API ${Build.VERSION.SDK_INT})")
            InfoRow("Model", "${Build.MANUFACTURER} ${Build.MODEL}")
            InfoRow("App", BuildConfig.VERSION_NAME)
            InfoRow("Server", BuildConfig.SERVER_URL.removePrefix("https://"))
        }

        SecondaryButton("Attempt log", onClick = onLog, modifier = Modifier.fillMaxWidth())

        SecondaryButton("Set up this phone again", onClick = { confirmReset = true }, danger = true, modifier = Modifier.fillMaxWidth())
    }

    if (confirmReset) {
        AlertDialog(
            onDismissRequest = { confirmReset = false },
            title = { Text("Set up this phone again?") },
            text = { Text("This deletes the phone's key. You'll register again, and if this phone was linked to you, your lecturer has to reset it first.") },
            confirmButton = { TextButton(onClick = { confirmReset = false; onSetUpAgain() }) { Text("Delete key and set up") } },
            dismissButton = { TextButton(onClick = { confirmReset = false }) { Text("Cancel") } },
        )
    }
}

@Composable
private fun InfoRow(label: String, value: String) {
    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
        Text(label, style = MaterialTheme.typography.bodyMedium, color = Lumora.colors.inkMuted, modifier = Modifier.weight(0.35f))
        Text(value, style = if (label == "Device") MonoText else MaterialTheme.typography.bodyMedium, modifier = Modifier.weight(0.65f))
    }
}
