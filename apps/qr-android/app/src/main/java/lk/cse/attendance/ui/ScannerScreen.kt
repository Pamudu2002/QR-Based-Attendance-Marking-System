package lk.cse.attendance.ui

import android.Manifest
import android.content.pm.PackageManager
import android.os.SystemClock
import android.util.Size
import androidx.activity.compose.BackHandler
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.camera.core.Camera
import androidx.camera.core.CameraSelector
import androidx.camera.core.ImageAnalysis
import androidx.camera.core.Preview
import androidx.camera.core.resolutionselector.ResolutionSelector
import androidx.camera.core.resolutionselector.ResolutionStrategy
import androidx.camera.lifecycle.ProcessCameraProvider
import androidx.camera.view.PreviewView
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
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.Close
import androidx.compose.material.icons.outlined.FlashlightOff
import androidx.compose.material.icons.outlined.FlashlightOn
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.core.content.ContextCompat
import androidx.lifecycle.compose.LocalLifecycleOwner
import java.util.concurrent.Executors
import kotlinx.coroutines.delay
import lk.cse.attendance.core.QrPayload
import lk.cse.attendance.data.DecodedScan
import lk.cse.attendance.data.WifiReader
import lk.cse.attendance.scan.ScanStats
import lk.cse.attendance.scan.QrAnalyzer
import lk.cse.attendance.ui.theme.Lumora
import lk.cse.attendance.ui.theme.MonoText

/**
 * Camera scanner (design/screens/AppScanner.dc.html). The camera view stays dark
 * in both themes. One Scan button handles both kinds of code (PLAN §5.1):
 * registration codes go to [onRegistrationCode], check-in codes to [onCheckInCode]
 * with the timings from Scan pressed (t0) to the first decode (t1).
 *
 * @param checkIns false for the registration re-scan: only registration codes, nothing logged.
 */
@Composable
fun ScannerScreen(
    timeoutSec: Int,
    checkIns: Boolean,
    onClose: () -> Unit,
    onRegistrationCode: (token: String, decodedNanos: Long) -> Unit,
    onCheckInCode: (DecodedScan) -> Unit,
    onNoDecode: (t0Nanos: Long, stats: ScanStats, ssid: String?) -> Unit,
    onClosedEarly: (t0Nanos: Long, stats: ScanStats, ssid: String?) -> Unit,
) {
    val context = LocalContext.current
    var hasCamera by remember {
        mutableStateOf(ContextCompat.checkSelfPermission(context, Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED)
    }
    val permission = rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission()) { hasCamera = it }
    LaunchedEffect(Unit) { if (!hasCamera) permission.launch(Manifest.permission.CAMERA) }

    var message by remember { mutableStateOf<String?>(null) }
    var frames by remember { mutableIntStateOf(0) }
    var attempt by remember { mutableIntStateOf(0) }
    var timedOut by remember { mutableStateOf(false) }
    var decoded by remember { mutableStateOf(false) }
    var torch by remember { mutableStateOf(false) }
    var camera by remember { mutableStateOf<Camera?>(null) }
    var wifi by remember { mutableStateOf<WifiReader.Reading?>(null) }
    // t0: Scan pressed (or Try again). Monotonic clock only.
    val startedNanos = remember(attempt) { SystemClock.elapsedRealtimeNanos() }
    val timeoutMs = timeoutSec * 1000L

    LaunchedEffect(Unit) { if (checkIns) wifi = WifiReader.read(context) }

    val analyzer = remember(attempt) {
        QrAnalyzer(
            onFrame = { frames = it },
            onDecoded = { text, stats ->
                ContextCompat.getMainExecutor(context).execute {
                    when (val payload = QrPayload.parse(text)) {
                        is QrPayload.Registration -> {
                            decoded = true
                            onRegistrationCode(payload.token, stats.decodedNanos)
                        }
                        is QrPayload.CheckIn -> if (checkIns) {
                            decoded = true
                            onCheckInCode(DecodedScan(payload.token, startedNanos, stats, wifi?.ssid))
                        } else {
                            message = "That's a check-in code. Scan the registration code on the projector."
                            attempt++
                        }
                        null -> {
                            message = "That isn't a CSE Attendance code. Scan the code on the projector."
                            attempt++
                        }
                    }
                }
            },
        )
    }
    fun statsNow() = ScanStats(analyzer.framesProcessed, analyzer.framesDropped, analyzer.firstFrameNanos, 0L)

    fun close() {
        if (checkIns && !decoded && !timedOut) onClosedEarly(startedNanos, statsNow(), wifi?.ssid)
        onClose()
    }
    BackHandler { close() }

    Box(Modifier.fillMaxSize().background(Color(0xFF0B0F10))) {
        if (hasCamera) {
            CameraPreview(analyzer = analyzer, onCamera = { camera = it }, paused = timedOut)
        } else {
            Text(
                "Allow the camera to scan the code on the projector.",
                color = Color.White,
                modifier = Modifier.align(Alignment.Center).padding(32.dp),
            )
        }

        // Frame guide
        Box(
            Modifier
                .align(Alignment.Center)
                .size(260.dp)
                .border(BorderStroke(3.dp, Color.White.copy(alpha = 0.9f)), RoundedCornerShape(16.dp)),
        )

        Row(
            Modifier.fillMaxWidth().statusBarsPadding().padding(8.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            IconButton(onClick = ::close) { Icon(Icons.Outlined.Close, contentDescription = "Close scanner", tint = Color.White) }
            Text("Scan the class QR", color = Color.White, style = MaterialTheme.typography.titleMedium, modifier = Modifier.weight(1f))
            IconButton(onClick = {
                torch = !torch
                camera?.cameraControl?.enableTorch(torch)
            }) {
                Icon(if (torch) Icons.Outlined.FlashlightOn else Icons.Outlined.FlashlightOff, contentDescription = "Torch", tint = Color.White)
            }
        }

        Surface(
            modifier = Modifier.align(Alignment.BottomCenter).fillMaxWidth(),
            color = Lumora.colors.surface,
            shape = RoundedCornerShape(topStart = 16.dp, topEnd = 16.dp),
        ) {
            Column(
                Modifier.navigationBarsPadding().padding(20.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp),
            ) {
                var elapsedSec by remember(attempt) { mutableIntStateOf(0) }
                LaunchedEffect(attempt, hasCamera) {
                    timedOut = false
                    while (hasCamera) {
                        delay(250)
                        val ms = (SystemClock.elapsedRealtimeNanos() - startedNanos) / 1_000_000
                        elapsedSec = (ms / 1000).toInt()
                        if (ms >= timeoutMs) {
                            timedOut = true
                            analyzer.pause()
                            if (checkIns) onNoDecode(startedNanos, statsNow(), wifi?.ssid)
                            break
                        }
                    }
                }
                if (timedOut) {
                    Notice(Tone.Warning, "Move a little closer, keep the whole code inside the frame, and try again.", lead = "Couldn't read the code.")
                    PrimaryButton("Try again", onClick = { message = null; attempt++ })
                } else {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Text("Looking for the code", style = MaterialTheme.typography.titleSmall, modifier = Modifier.weight(1f))
                        Text("$elapsedSec s", style = MonoText, color = Lumora.colors.inkMuted)
                    }
                    Row(horizontalArrangement = Arrangement.spacedBy(24.dp), verticalAlignment = Alignment.Bottom) {
                        if (checkIns) {
                            Column(Modifier.weight(1f)) {
                                Text("Wi-Fi", style = MaterialTheme.typography.labelMedium, color = Lumora.colors.inkMuted)
                                val w = wifi
                                when {
                                    w == null -> Text("Reading…", style = MonoText)
                                    w.ssid != WifiReader.UNKNOWN -> StatusBadge(w.ssid, Tone.Success)
                                    else -> StatusBadge(if (w.locationOff) "Turn on location" else "Unknown", Tone.Warning)
                                }
                            }
                        }
                        Column {
                            Text("Frames read", style = MaterialTheme.typography.labelMedium, color = Lumora.colors.inkMuted)
                            Text("$frames", style = MonoText)
                        }
                        Column {
                            Text("Stops in", style = MaterialTheme.typography.labelMedium, color = Lumora.colors.inkMuted)
                            Text("${(timeoutSec - elapsedSec).coerceAtLeast(0)} s", style = MonoText)
                        }
                    }
                    message?.let { Notice(Tone.Warning, it) } ?: Notice(Tone.Tip, "sitting far back? Move a little closer.", lead = "Tip:")
                }
                SecondaryButton("Cancel", onClick = ::close, modifier = Modifier.fillMaxWidth())
            }
        }
    }
}

/**
 * CameraX preview + ImageAnalysis at a fixed 1280×720, STRATEGY_KEEP_ONLY_LATEST,
 * YUV_420_888 (CLAUDE.md, Android conventions).
 */
@Composable
private fun CameraPreview(analyzer: QrAnalyzer, onCamera: (Camera) -> Unit, paused: Boolean) {
    val context = LocalContext.current
    val lifecycleOwner = LocalLifecycleOwner.current
    val previewView = remember { PreviewView(context).apply { scaleType = PreviewView.ScaleType.FILL_CENTER } }
    val executor = remember { Executors.newSingleThreadExecutor() }

    LaunchedEffect(paused) { if (paused) analyzer.pause() }

    DisposableEffect(analyzer) {
        val providerFuture = ProcessCameraProvider.getInstance(context)
        var provider: ProcessCameraProvider? = null
        providerFuture.addListener({
            val p = providerFuture.get()
            provider = p
            val preview = Preview.Builder().build().also { it.setSurfaceProvider(previewView.surfaceProvider) }
            val analysis = ImageAnalysis.Builder()
                .setResolutionSelector(
                    ResolutionSelector.Builder()
                        .setResolutionStrategy(ResolutionStrategy(Size(1280, 720), ResolutionStrategy.FALLBACK_RULE_CLOSEST_HIGHER_THEN_LOWER))
                        .build(),
                )
                .setBackpressureStrategy(ImageAnalysis.STRATEGY_KEEP_ONLY_LATEST)
                .setOutputImageFormat(ImageAnalysis.OUTPUT_IMAGE_FORMAT_YUV_420_888)
                .build()
                .also { it.setAnalyzer(executor, analyzer) }
            p.unbindAll()
            onCamera(p.bindToLifecycle(lifecycleOwner, CameraSelector.DEFAULT_BACK_CAMERA, preview, analysis))
        }, ContextCompat.getMainExecutor(context))
        onDispose {
            analyzer.pause()
            provider?.unbindAll()
        }
    }
    DisposableEffect(Unit) { onDispose { executor.shutdown() } }

    AndroidView(factory = { previewView }, modifier = Modifier.fillMaxSize())
}
