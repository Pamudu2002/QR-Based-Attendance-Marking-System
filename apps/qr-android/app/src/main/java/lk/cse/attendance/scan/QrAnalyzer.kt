package lk.cse.attendance.scan

import android.os.SystemClock
import androidx.camera.core.ImageAnalysis
import androidx.camera.core.ImageProxy
import com.google.zxing.BarcodeFormat
import com.google.zxing.BinaryBitmap
import com.google.zxing.DecodeHintType
import com.google.zxing.ReaderException
import com.google.zxing.common.HybridBinarizer
import com.google.zxing.qrcode.QRCodeReader
import com.google.zxing.PlanarYUVLuminanceSource
import java.util.concurrent.atomic.AtomicBoolean

/** Frame counts and the first-frame time, for the attempt log (docs/PLAN.md §5.2). */
data class ScanStats(
    val framesProcessed: Int,
    val framesDropped: Int,
    /** elapsedRealtimeNanos when the first frame reached the analyzer, or 0. */
    val firstFrameNanos: Long,
    /** elapsedRealtimeNanos of the successful decode. */
    val decodedNanos: Long,
)

/**
 * Decodes QR codes from CameraX YUV_420_888 frames with ZXing core: only the Y
 * (luminance) plane is used, through PlanarYUVLuminanceSource. Fixed hints so
 * every phone does the same work.
 *
 * With STRATEGY_KEEP_ONLY_LATEST, CameraX drops frames while we are busy. We
 * count those from gaps in the frame timestamps.
 */
class QrAnalyzer(
    private val onDecoded: (text: String, stats: ScanStats) -> Unit,
    private val onFrame: (framesProcessed: Int) -> Unit = {},
) : ImageAnalysis.Analyzer {

    private val reader = QRCodeReader()
    private val hints = mapOf(
        DecodeHintType.POSSIBLE_FORMATS to listOf(BarcodeFormat.QR_CODE),
        DecodeHintType.TRY_HARDER to true,
    )
    private val paused = AtomicBoolean(false)
    private var buffer = ByteArray(0)

    @Volatile var framesProcessed = 0
        private set
    @Volatile var framesDropped = 0
        private set
    @Volatile var firstFrameNanos = 0L
        private set

    private var lastTimestampNs = 0L
    private var minIntervalNs = Long.MAX_VALUE

    /** Stop decoding (after a result) until [resume]. */
    fun pause() = paused.set(true)

    fun resume() = paused.set(false)

    override fun analyze(image: ImageProxy) {
        try {
            if (paused.get()) return
            if (firstFrameNanos == 0L) firstFrameNanos = SystemClock.elapsedRealtimeNanos()
            countDropped(image.imageInfo.timestamp)
            framesProcessed++
            onFrame(framesProcessed)

            val text = decode(image) ?: return
            if (paused.compareAndSet(false, true)) {
                onDecoded(text, ScanStats(framesProcessed, framesDropped, firstFrameNanos, SystemClock.elapsedRealtimeNanos()))
            }
        } finally {
            image.close()
        }
    }

    private fun countDropped(timestampNs: Long) {
        if (lastTimestampNs != 0L) {
            val gap = timestampNs - lastTimestampNs
            if (gap > 0) {
                if (gap < minIntervalNs) minIntervalNs = gap
                // A gap of ~2 frame intervals means one frame was dropped, and so on.
                val missed = ((gap + minIntervalNs / 2) / minIntervalNs - 1).toInt()
                if (missed > 0) framesDropped += missed
            }
        }
        lastTimestampNs = timestampNs
    }

    private fun decode(image: ImageProxy): String? {
        val plane = image.planes[0]
        val rowStride = plane.rowStride
        val height = image.height
        val needed = rowStride * height
        if (buffer.size < needed) buffer = ByteArray(needed)
        val y = plane.buffer
        y.rewind()
        // The last row can be shorter than rowStride; the rest of the buffer stays as it was.
        y.get(buffer, 0, minOf(y.remaining(), needed))

        val source = PlanarYUVLuminanceSource(buffer, rowStride, height, 0, 0, image.width, height, false)
        return try {
            reader.decode(BinaryBitmap(HybridBinarizer(source)), hints).text
        } catch (e: ReaderException) {
            null // NotFound, Checksum or Format: no readable code in this frame
        } finally {
            reader.reset()
        }
    }
}
