package lk.cse.attendance.beacon

import android.Manifest
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import android.os.Bundle
import android.provider.Settings
import androidx.activity.ComponentActivity
import androidx.activity.compose.BackHandler
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
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
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.Bluetooth
import androidx.compose.material.icons.outlined.BluetoothDisabled
import androidx.compose.material.icons.outlined.CameraAlt
import androidx.compose.material.icons.outlined.Check
import androidx.compose.material.icons.outlined.Close
import androidx.compose.material.icons.outlined.CloudOff
import androidx.compose.material.icons.outlined.Notifications
import androidx.compose.material.icons.outlined.QrCodeScanner
import androidx.compose.material.icons.outlined.Sensors
import androidx.compose.material.icons.outlined.Schedule
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.SegmentedButton
import androidx.compose.material3.SegmentedButtonDefaults
import androidx.compose.material3.SingleChoiceSegmentedButtonRow
import androidx.compose.material3.Switch
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
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.core.content.ContextCompat
import androidx.lifecycle.compose.LifecycleResumeEffect
import kotlinx.coroutines.launch
import lk.cse.attendance.BuildConfig
import lk.cse.attendance.data.ApiException
import lk.cse.attendance.scan.QrAnalyzer
import lk.cse.attendance.ui.BrandName
import lk.cse.attendance.ui.CameraPreview
import lk.cse.attendance.ui.LuCard
import lk.cse.attendance.ui.Notice
import lk.cse.attendance.ui.PrimaryButton
import lk.cse.attendance.ui.SecondaryButton
import lk.cse.attendance.ui.StatusBadge
import lk.cse.attendance.ui.Tone
import lk.cse.attendance.ui.theme.CseAttendanceTheme
import lk.cse.attendance.ui.theme.Lumora
import lk.cse.attendance.ui.theme.MonoText

/** CSE Attendance Beacon: link once, then leave it open on the desk (PLAN §6.5). */
class BeaconActivity : ComponentActivity() {
    private var linked by mutableStateOf(false)

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        val app = application as BeaconApp
        linked = app.linked
        if (linked && app.prefs.onDuty) BeaconService.start(this)
        setContent {
            CseAttendanceTheme {
                if (linked) {
                    MainScreen(app, onUnlinked = { linked = false })
                } else {
                    LinkScreen(app, onLinked = {
                        linked = true
                        app.prefs.onDuty = true
                        BeaconService.start(this)
                    })
                }
            }
        }
    }
}

private fun granted(context: android.content.Context, p: String) =
    ContextCompat.checkSelfPermission(context, p) == PackageManager.PERMISSION_GRANTED

// ── Link ──────────────────────────────────────────────────────────────────

@Composable
private fun LinkScreen(app: BeaconApp, onLinked: () -> Unit) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    var camera by remember { mutableStateOf(granted(context, Manifest.permission.CAMERA)) }
    var nearby by remember { mutableStateOf(Broadcaster.hasPermission(context)) }
    val needsNotifications = Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU
    var notifications by remember { mutableStateOf(!needsNotifications || granted(context, Manifest.permission.POST_NOTIFICATIONS)) }
    var scanning by remember { mutableStateOf(false) }
    var busy by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }
    var server by remember { mutableStateOf(app.prefs.serverUrl) }
    var editServer by remember { mutableStateOf(false) }

    val cameraLauncher = rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission()) {
        camera = it
        if (it) scanning = true
    }
    val nearbyLauncher = rememberLauncherForActivityResult(ActivityResultContracts.RequestMultiplePermissions()) { nearby = Broadcaster.hasPermission(context) }
    val notificationLauncher = rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission()) { notifications = it }

    fun link(text: String) {
        scanning = false
        if (!text.startsWith("QA1:B:")) {
            error = "That isn't a beacon link code. In the portal, open Beacon phones and tap Show link code."
            return
        }
        busy = true
        error = null
        scope.launch {
            try {
                app.api.link(context, text)
                onLinked()
            } catch (e: ApiException) {
                error = e.message
            } catch (e: Exception) {
                error = e.message ?: "Couldn't link this phone. Try again."
            } finally {
                busy = false
            }
        }
    }

    if (scanning) {
        LinkScanner(onCode = ::link, onClose = { scanning = false })
        return
    }

    Column(
        Modifier
            .fillMaxSize()
            .background(Lumora.colors.surface)
            .statusBarsPadding()
            .navigationBarsPadding()
            .verticalScroll(rememberScrollState())
            .padding(start = 20.dp, end = 20.dp, top = 16.dp, bottom = 24.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp),
    ) {
        Column {
            BrandName()
            Text("Beacon", style = MaterialTheme.typography.labelLarge, color = Lumora.colors.brand)
        }
        Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
            Text("Turn this phone into a classroom beacon", style = MaterialTheme.typography.headlineSmall.copy(fontSize = MaterialTheme.typography.titleLarge.fontSize))
            Text(
                "Leave it on your desk during class. It broadcasts while check-in is open, so students' phones can prove they're in the room.",
                style = MaterialTheme.typography.bodyMedium,
                color = Lumora.colors.inkMuted,
            )
        }

        LuCard(padding = false) {
            PermissionRow(Icons.Outlined.CameraAlt, "Camera", "To scan the link code once", done = camera) {
                TextButton(onClick = { cameraLauncher.launch(Manifest.permission.CAMERA) }) { Text("Allow") }
            }
            HorizontalDivider(color = Lumora.colors.line)
            PermissionRow(
                Icons.Outlined.Bluetooth,
                "Bluetooth",
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) "Nearby devices, to broadcast the beacon" else "No extra permission needed",
                done = nearby,
            ) {
                TextButton(onClick = { nearbyLauncher.launch(Broadcaster.permissions()) }) { Text("Allow") }
            }
            if (needsNotifications) {
                HorizontalDivider(color = Lumora.colors.line)
                PermissionRow(Icons.Outlined.Notifications, "Notifications", "Shows when the beacon is broadcasting", done = notifications) {
                    TextButton(onClick = { notificationLauncher.launch(Manifest.permission.POST_NOTIFICATIONS) }) { Text("Allow") }
                }
            }
        }

        Notice(Tone.Info, "In the portal, open Beacon phones and tap Show link code. The code works once and expires after 2 minutes.", lead = "Link code")
        error?.let { Notice(Tone.Danger, it) }

        PrimaryButton(
            "Scan the link code",
            onClick = { if (camera) scanning = true else cameraLauncher.launch(Manifest.permission.CAMERA) },
            icon = Icons.Outlined.QrCodeScanner,
            busy = busy,
        )
        ServerRow(server, enabled = !busy, onChange = { editServer = true })
    }

    if (editServer) {
        ServerDialog(server, onDismiss = { editServer = false }, onSave = {
            app.prefs.serverUrl = it
            server = app.prefs.serverUrl
            editServer = false
        })
    }
}

/** Camera scan for the link code, with the same decoder as the student app. */
@Composable
private fun LinkScanner(onCode: (String) -> Unit, onClose: () -> Unit) {
    val context = LocalContext.current
    val analyzer = remember {
        QrAnalyzer(onDecoded = { text, _ ->
            ContextCompat.getMainExecutor(context).execute { onCode(text) }
        })
    }
    BackHandler(onBack = onClose)
    Box(Modifier.fillMaxSize().background(Color(0xFF0B0F10))) {
        CameraPreview(analyzer = analyzer, onCamera = {}, paused = false)
        Box(
            Modifier
                .align(Alignment.Center)
                .size(260.dp)
                .border(BorderStroke(3.dp, Color.White.copy(alpha = 0.9f)), RoundedCornerShape(16.dp)),
        )
        Row(Modifier.fillMaxWidth().statusBarsPadding().padding(8.dp), verticalAlignment = Alignment.CenterVertically) {
            IconButton(onClick = onClose) { Icon(Icons.Outlined.Close, contentDescription = "Close scanner", tint = Color.White) }
            Text("Scan the link code", color = Color.White, style = MaterialTheme.typography.titleMedium)
        }
    }
}

// ── Main ──────────────────────────────────────────────────────────────────

@Composable
private fun MainScreen(app: BeaconApp, onUnlinked: () -> Unit) {
    val context = LocalContext.current
    val ui by BeaconService.ui.collectAsState()
    var onDuty by remember { mutableStateOf(app.prefs.onDuty) }
    var power by remember { mutableStateOf(app.prefs.power) }
    var server by remember { mutableStateOf(app.prefs.serverUrl) }
    var editServer by remember { mutableStateOf(false) }
    var confirmUnlink by remember { mutableStateOf(false) }
    val nearbyLauncher = rememberLauncherForActivityResult(ActivityResultContracts.RequestMultiplePermissions()) {}

    // Back from Settings or the portal: make sure the service runs while on duty.
    LifecycleResumeEffect(onDuty) {
        if (onDuty && !ui.running && ui.unlinked == null) BeaconService.start(context)
        onPauseOrDispose { }
    }

    fun unlink() {
        BeaconService.stop(context)
        BeaconKey.delete()
        app.prefs.unlink()
        onUnlinked()
    }

    Column(
        Modifier
            .fillMaxSize()
            .background(Lumora.colors.surfaceSunken)
            .statusBarsPadding()
            .navigationBarsPadding()
            .verticalScroll(rememberScrollState())
            .padding(start = 20.dp, end = 20.dp, top = 16.dp, bottom = 24.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp),
    ) {
        Column {
            BrandName()
            Text("Beacon · linked to ${app.prefs.lecturer ?: "your account"}", style = MaterialTheme.typography.bodyMedium, color = Lumora.colors.inkMuted)
        }

        ui.unlinked?.let { msg ->
            Notice(Tone.Danger, msg, lead = "This phone was unlinked.") {
                SecondaryButton("Link again", onClick = ::unlink)
            }
        }

        StatusCard(ui, onDuty)

        when {
            !onDuty -> Unit
            ui.problem == Problem.BLUETOOTH_OFF ->
                SecondaryButton("Open Bluetooth settings", onClick = { context.startActivity(Intent(Settings.ACTION_BLUETOOTH_SETTINGS)) }, modifier = Modifier.fillMaxWidth())
            ui.problem == Problem.NO_PERMISSION ->
                SecondaryButton("Allow Nearby devices", onClick = { nearbyLauncher.launch(Broadcaster.permissions()) }, modifier = Modifier.fillMaxWidth())
            else -> Unit
        }

        LuCard {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Column(Modifier.weight(1f)) {
                    Text("Beacon on", style = MaterialTheme.typography.titleSmall)
                    Text(
                        if (onDuty) "Starts and stops with check-in in the portal" else "Paused: it won't broadcast",
                        style = MaterialTheme.typography.bodySmall,
                        color = Lumora.colors.inkMuted,
                    )
                }
                Switch(checked = onDuty, onCheckedChange = {
                    onDuty = it
                    app.prefs.onDuty = it
                    if (it) BeaconService.start(context) else BeaconService.stop(context)
                })
            }
        }

        LuCard {
            Text("Range", style = MaterialTheme.typography.titleSmall)
            val options = listOf("LOW" to "Small room", "MEDIUM" to "Hall", "HIGH" to "Large hall")
            SingleChoiceSegmentedButtonRow(Modifier.fillMaxWidth()) {
                options.forEachIndexed { i, (value, label) ->
                    SegmentedButton(
                        selected = power == value,
                        onClick = {
                            power = value
                            app.prefs.power = value
                        },
                        shape = SegmentedButtonDefaults.itemShape(i, options.size),
                    ) { Text(label) }
                }
            }
            Text("Higher reaches the back rows but leaks further into corridors. Set it after testing in the hall.", style = MaterialTheme.typography.bodySmall, color = Lumora.colors.inkMuted)
        }

        Notice(Tone.Tip, "keep this phone on a charger during class, with Bluetooth on. You can lock the screen.", lead = "Tip:")
        ServerRow(server, enabled = true, onChange = { editServer = true })
        SecondaryButton("Unlink this phone", onClick = { confirmUnlink = true }, danger = true, modifier = Modifier.fillMaxWidth())
    }

    if (editServer) {
        ServerDialog(server, onDismiss = { editServer = false }, onSave = {
            app.prefs.serverUrl = it
            server = app.prefs.serverUrl
            editServer = false
        })
    }
    if (confirmUnlink) {
        AlertDialog(
            onDismissRequest = { confirmUnlink = false },
            title = { Text("Unlink this phone?") },
            text = { Text("It stops broadcasting for your classes. Also remove it under Beacon phones in the portal.") },
            confirmButton = { TextButton(onClick = { confirmUnlink = false; unlink() }) { Text("Unlink") } },
            dismissButton = { TextButton(onClick = { confirmUnlink = false }) { Text("Cancel") } },
        )
    }
}

@Composable
private fun StatusCard(ui: BeaconUi, onDuty: Boolean) {
    data class Look(val icon: ImageVector, val tone: Tone, val title: String, val detail: String)
    val run = ui.run
    val look = when {
        !onDuty -> Look(Icons.Outlined.Schedule, Tone.Neutral, "Paused", "Turn the beacon on to broadcast during check-in.")
        ui.problem == Problem.BLUETOOTH_OFF -> Look(Icons.Outlined.BluetoothDisabled, Tone.Danger, "Bluetooth is off", "Turn on Bluetooth so students' phones can hear the beacon.")
        ui.problem == Problem.NO_PERMISSION -> Look(Icons.Outlined.BluetoothDisabled, Tone.Danger, "Not allowed to broadcast", "Allow Nearby devices for CSE Attendance Beacon.")
        ui.problem == Problem.CANT_BROADCAST -> Look(Icons.Outlined.BluetoothDisabled, Tone.Danger, "This phone can't broadcast", "Its Bluetooth doesn't support beacons. Use another Android phone.")
        ui.broadcasting && run != null -> Look(Icons.Outlined.Sensors, Tone.Success, "Broadcasting", "${run.module.displayName}\n${run.session.title} · ${run.session.venue}")
        ui.offline -> Look(Icons.Outlined.CloudOff, Tone.Warning, "No connection", "Can't reach the server. Check this phone's internet connection.")
        else -> Look(Icons.Outlined.Schedule, Tone.Neutral, "Waiting for check-in", "It starts when you press Start check-in in the portal.")
    }
    LuCard {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(14.dp)) {
            val color = when (look.tone) {
                Tone.Success -> Lumora.colors.success
                Tone.Danger -> Lumora.colors.danger
                Tone.Warning -> Lumora.colors.warning
                else -> Lumora.colors.inkMuted
            }
            Box(Modifier.size(48.dp).background(Lumora.colors.surfaceSunken, CircleShape), contentAlignment = Alignment.Center) {
                Icon(look.icon, contentDescription = null, tint = color, modifier = Modifier.size(26.dp))
            }
            Column(Modifier.weight(1f)) {
                Text(look.title, style = MaterialTheme.typography.titleMedium)
                Text(look.detail, style = MaterialTheme.typography.bodyMedium, color = Lumora.colors.inkMuted)
            }
        }
        if (ui.broadcasting && run != null) {
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                StatusBadge(if (run.requireBeacon) "Required for check-in" else "Recorded only", if (run.requireBeacon) Tone.Success else Tone.Neutral, Icons.Outlined.Check)
                if (run.mode != "NORMAL") StatusBadge("Experiment run", Tone.Brand)
            }
        }
    }
}

@Composable
private fun PermissionRow(icon: ImageVector, title: String, subtitle: String, done: Boolean, action: @Composable () -> Unit) {
    Row(
        Modifier.fillMaxWidth().background(if (done) Lumora.colors.surface else Lumora.colors.selected).padding(14.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        Box(Modifier.size(36.dp).background(if (done) Lumora.colors.surfaceSunken else Lumora.colors.surface, CircleShape), contentAlignment = Alignment.Center) {
            Icon(icon, contentDescription = null, tint = if (done) Lumora.colors.inkMuted else Lumora.colors.brand, modifier = Modifier.size(18.dp))
        }
        Column(Modifier.weight(1f)) {
            Text(title, style = MaterialTheme.typography.titleSmall)
            Text(subtitle, style = MaterialTheme.typography.bodySmall, color = Lumora.colors.inkMuted)
        }
        if (done) StatusBadge("Allowed", Tone.Success, Icons.Outlined.Check) else action()
    }
}

@Composable
private fun ServerRow(server: String, enabled: Boolean, onChange: () -> Unit) {
    Row(verticalAlignment = Alignment.CenterVertically) {
        Column(Modifier.weight(1f)) {
            Text("Server", style = MaterialTheme.typography.labelMedium, color = Lumora.colors.inkMuted)
            Text(server, style = MonoText, color = Lumora.colors.inkMuted)
        }
        TextButton(onClick = onChange, enabled = enabled) { Text("Change") }
    }
}

@Composable
private fun ServerDialog(current: String, onDismiss: () -> Unit, onSave: (String) -> Unit) {
    var draft by remember { mutableStateOf(current) }
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Change server") },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Text("For testing on a laptop, use http://<laptop IP>:3000 on the same Wi-Fi.", style = MaterialTheme.typography.bodyMedium, color = Lumora.colors.inkMuted)
                OutlinedTextField(
                    value = draft,
                    onValueChange = { draft = it },
                    singleLine = true,
                    textStyle = MonoText,
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Uri),
                    modifier = Modifier.fillMaxWidth(),
                )
                TextButton(onClick = { draft = BuildConfig.SERVER_URL }) { Text("Use default") }
            }
        },
        confirmButton = { TextButton(onClick = { onSave(draft) }) { Text("Save") } },
        dismissButton = { TextButton(onClick = onDismiss) { Text("Cancel") } },
    )
}
