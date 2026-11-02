package lk.cse.attendance.ui

import android.Manifest
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import android.provider.Settings
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
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
import androidx.compose.material.icons.outlined.Bluetooth
import androidx.compose.material.icons.outlined.CameraAlt
import androidx.compose.material.icons.outlined.Check
import androidx.compose.material.icons.outlined.Key
import androidx.compose.material.icons.outlined.QrCode2
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
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
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.core.content.ContextCompat
import kotlinx.coroutines.launch
import lk.cse.attendance.MainActivity
import lk.cse.attendance.data.BeaconListener
import lk.cse.attendance.data.Session
import lk.cse.attendance.security.AuthCancelledException
import lk.cse.attendance.security.NoScreenLockException
import lk.cse.attendance.ui.theme.Lumora

/** Welcome / setup (design/screens/AppWelcome.dc.html). */
@Composable
fun SetupScreen(session: Session, activity: MainActivity, onDone: () -> Unit) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    fun granted(p: String) = ContextCompat.checkSelfPermission(context, p) == PackageManager.PERMISSION_GRANTED

    var camera by remember { mutableStateOf(granted(Manifest.permission.CAMERA)) }
    // Bluetooth for the classroom beacon (PLAN §6.5): "Nearby devices" on Android 12+, location before that.
    val bluetoothNeedsLocation = Build.VERSION.SDK_INT < Build.VERSION_CODES.S
    var bluetooth by remember { mutableStateOf(BeaconListener.hasPermission(context)) }
    var keyCreated by remember { mutableStateOf(false) }
    var busy by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }
    var noScreenLock by remember { mutableStateOf(false) }

    val cameraLauncher = rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission()) { camera = it }
    val bluetoothLauncher = rememberLauncherForActivityResult(ActivityResultContracts.RequestMultiplePermissions()) {
        bluetooth = BeaconListener.hasPermission(context)
    }

    fun continueSetup() {
        if (!camera) {
            cameraLauncher.launch(Manifest.permission.CAMERA)
            return
        }
        busy = true
        error = null
        noScreenLock = false
        scope.launch {
            try {
                session.setUp(activity)
                keyCreated = true
                onDone()
            } catch (e: NoScreenLockException) {
                noScreenLock = true
            } catch (e: AuthCancelledException) {
                error = "Setup needs your fingerprint or PIN once. Tap Continue to try again."
            } catch (e: Exception) {
                error = friendlyMessage(e)
            } finally {
                busy = false
            }
        }
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
        BrandName()

        Box(
            Modifier
                .fillMaxWidth()
                .background(Lumora.colors.canvas, MaterialTheme.shapes.medium)
                .padding(24.dp),
        ) {
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(18.dp)) {
                Box(Modifier.background(Lumora.colors.paper).padding(10.dp)) {
                    Icon(Icons.Outlined.QrCode2, contentDescription = null, tint = Color.Black, modifier = Modifier.size(72.dp))
                }
                Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                    Text("Check in with one scan", style = MaterialTheme.typography.headlineSmall.copy(fontSize = MaterialTheme.typography.titleLarge.fontSize))
                    Text("Scan the QR on the projector and confirm with your fingerprint or PIN.", color = Lumora.colors.inkMuted, style = MaterialTheme.typography.bodyMedium)
                }
            }
        }

        Column {
            Text("Set up this phone", style = MaterialTheme.typography.titleLarge)
            Text("About a minute. You only do this once.", color = Lumora.colors.inkMuted, style = MaterialTheme.typography.bodyMedium)
        }

        LuCard(padding = false) {
            SetupRow(Icons.Outlined.CameraAlt, "Camera", "To read the QR on the projector", done = camera, doneText = "Allowed") {
                TextButton(onClick = { cameraLauncher.launch(Manifest.permission.CAMERA) }) { Text("Allow") }
            }
            HorizontalDivider(color = Lumora.colors.line)
            SetupRow(Icons.Outlined.Key, "Secure key", "Stays in this phone's security chip", done = keyCreated, doneText = "Created") {
                Text("On Continue", style = MaterialTheme.typography.labelMedium, color = Lumora.colors.inkMuted)
            }
            HorizontalDivider(color = Lumora.colors.line)
            SetupRow(
                Icons.Outlined.Bluetooth,
                "Bluetooth",
                if (bluetoothNeedsLocation) "To find the classroom beacon. Android asks for location to use it" else "To find the classroom beacon",
                done = bluetooth,
                doneText = "Allowed",
            ) {
                TextButton(onClick = { bluetoothLauncher.launch(BeaconListener.permissions()) }) { Text("Allow") }
            }
        }

        Notice(Tone.Info, "Your fingerprint never leaves this phone. CSE Attendance doesn't track where you are.")

        if (noScreenLock) {
            Notice(Tone.Warning, "Set a PIN, pattern, password or fingerprint, then come back and tap Continue.", lead = "This phone has no screen lock.") {
                SecondaryButton("Open security settings", onClick = { context.startActivity(Intent(Settings.ACTION_SECURITY_SETTINGS)) })
            }
        }
        error?.let { Notice(Tone.Danger, it) }

        PrimaryButton(if (camera) "Continue" else "Allow camera and continue", onClick = ::continueSetup, busy = busy)
        Text(
            "Works on Android 6.0 and newer",
            style = MaterialTheme.typography.bodySmall,
            color = Lumora.colors.inkMuted,
            textAlign = TextAlign.Center,
            modifier = Modifier.fillMaxWidth(),
        )
    }
}

@Composable
private fun SetupRow(icon: ImageVector, title: String, subtitle: String, done: Boolean, doneText: String, action: @Composable () -> Unit) {
    Row(
        Modifier
            .fillMaxWidth()
            .background(if (done) Lumora.colors.surface else Lumora.colors.selected)
            .padding(14.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        Box(
            Modifier.size(36.dp).background(if (done) Lumora.colors.surfaceSunken else Lumora.colors.surface, CircleShape),
            contentAlignment = Alignment.Center,
        ) {
            Icon(icon, contentDescription = null, tint = if (done) Lumora.colors.inkMuted else Lumora.colors.brand, modifier = Modifier.size(18.dp))
        }
        Column(Modifier.weight(1f)) {
            Text(title, style = MaterialTheme.typography.titleSmall)
            Text(subtitle, style = MaterialTheme.typography.bodySmall, color = Lumora.colors.inkMuted)
        }
        if (done) StatusBadge(doneText, Tone.Success, Icons.Outlined.Check) else action()
    }
}
