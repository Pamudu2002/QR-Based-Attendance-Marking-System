package lk.cse.attendance.data

import android.Manifest
import android.annotation.SuppressLint
import android.bluetooth.BluetoothManager
import android.bluetooth.le.ScanCallback
import android.bluetooth.le.ScanFilter
import android.bluetooth.le.ScanResult
import android.bluetooth.le.ScanSettings
import android.content.Context
import android.content.pm.PackageManager
import android.location.LocationManager
import android.os.Build
import android.os.SystemClock
import android.util.Base64
import androidx.core.content.ContextCompat
import androidx.core.location.LocationManagerCompat
import java.util.concurrent.ConcurrentHashMap
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import lk.cse.attendance.core.BeaconCode

/**
 * Listens for the classroom beacon while the student checks in (PLAN §6.5), with
 * BluetoothLeScanner filtered to our manufacturer data. What Android needs:
 *  12+ (API 31+): BLUETOOTH_SCAN ("Nearby devices"), declared neverForLocation.
 *  6–11: a location permission and location switched on, or scans find nothing.
 */
class BeaconListener(context: Context) {
    private val app = context.applicationContext

    enum class Status { SCANNING, HEARD, BLUETOOTH_OFF, NO_PERMISSION, LOCATION_OFF, NO_BLUETOOTH }

    private class Heard(val data: ByteArray, val rssi: Int, val atNanos: Long)

    private val heard = ConcurrentHashMap<String, Heard>()
    private val _status = MutableStateFlow(Status.SCANNING)
    val status: StateFlow<Status> = _status
    private var callback: ScanCallback? = null

    companion object {
        /** The runtime permissions to ask for on this Android version. */
        fun permissions(): Array<String> = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            arrayOf(Manifest.permission.BLUETOOTH_SCAN)
        } else {
            arrayOf(Manifest.permission.ACCESS_FINE_LOCATION, Manifest.permission.ACCESS_COARSE_LOCATION)
        }

        fun hasPermission(context: Context): Boolean = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            granted(context, Manifest.permission.BLUETOOTH_SCAN)
        } else if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            granted(context, Manifest.permission.ACCESS_FINE_LOCATION)
        } else {
            granted(context, Manifest.permission.ACCESS_FINE_LOCATION) || granted(context, Manifest.permission.ACCESS_COARSE_LOCATION)
        }

        /** Android 6–11 return no scan results while location is switched off. */
        fun needsLocationOn(context: Context): Boolean =
            Build.VERSION.SDK_INT < Build.VERSION_CODES.S &&
                !LocationManagerCompat.isLocationEnabled(context.getSystemService(LocationManager::class.java))

        private fun granted(context: Context, p: String) = ContextCompat.checkSelfPermission(context, p) == PackageManager.PERMISSION_GRANTED
    }

    /** Starts (or restarts) scanning. Safe to call again; the status says why it can't scan. */
    @SuppressLint("MissingPermission")
    fun start(): Status {
        stop()
        heard.clear()
        val adapter = app.getSystemService(BluetoothManager::class.java)?.adapter ?: return set(Status.NO_BLUETOOTH)
        if (!hasPermission(app)) return set(Status.NO_PERMISSION)
        if (!adapter.isEnabled) return set(Status.BLUETOOTH_OFF)
        if (needsLocationOn(app)) return set(Status.LOCATION_OFF)
        val scanner = adapter.bluetoothLeScanner ?: return set(Status.BLUETOOTH_OFF)

        val filter = ScanFilter.Builder()
            .setManufacturerData(BeaconCode.COMPANY_ID, BeaconCode.PREFIX, byteArrayOf(-1, -1, -1))
            .build()
        val settings = ScanSettings.Builder().setScanMode(ScanSettings.SCAN_MODE_LOW_LATENCY).build()
        val cb = object : ScanCallback() {
            override fun onScanResult(callbackType: Int, result: ScanResult) {
                val data = result.scanRecord?.getManufacturerSpecificData(BeaconCode.COMPANY_ID)
                if (!BeaconCode.isBeacon(data)) return
                heard[data!!.joinToString("") { "%02x".format(it) }] = Heard(data, result.rssi, SystemClock.elapsedRealtimeNanos())
                _status.value = Status.HEARD
            }

            override fun onScanFailed(errorCode: Int) {
                _status.value = Status.BLUETOOTH_OFF
            }
        }
        return try {
            scanner.startScan(listOf(filter), settings, cb)
            callback = cb
            set(Status.SCANNING)
        } catch (e: SecurityException) {
            set(Status.NO_PERMISSION)
        }
    }

    @SuppressLint("MissingPermission")
    fun stop() {
        val cb = callback ?: return
        callback = null
        runCatching { app.getSystemService(BluetoothManager::class.java)?.adapter?.bluetoothLeScanner?.stopScan(cb) }
    }

    /**
     * Codes heard in the last 30 s, strongest first (at most 5). With [waitMs], waits
     * that long for a first one if nothing has been heard yet.
     */
    suspend fun recent(waitMs: Long = 0): List<BeaconHeard> {
        val until = SystemClock.elapsedRealtime() + waitMs
        while (heard.isEmpty() && callback != null && SystemClock.elapsedRealtime() < until) delay(150)
        val now = SystemClock.elapsedRealtimeNanos()
        return heard.values
            .filter { now - it.atNanos < 30_000_000_000L }
            .sortedByDescending { it.rssi }
            .take(5)
            .map { BeaconHeard(Base64.encodeToString(it.data, Base64.NO_WRAP), it.rssi, (now - it.atNanos) / 1_000_000.0) }
    }

    private fun set(s: Status): Status {
        _status.value = s
        return s
    }
}
