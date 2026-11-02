package lk.cse.attendance.beacon

import android.Manifest
import android.annotation.SuppressLint
import android.bluetooth.BluetoothManager
import android.bluetooth.le.AdvertiseCallback
import android.bluetooth.le.AdvertiseData
import android.bluetooth.le.AdvertiseSettings
import android.content.Context
import android.content.pm.PackageManager
import android.os.Build
import androidx.core.content.ContextCompat
import lk.cse.attendance.core.BeaconCode

/** What stops the phone from broadcasting, if anything. */
enum class Problem(val serverState: String) {
    BLUETOOTH_OFF("bluetooth_off"),
    NO_PERMISSION("no_permission"),
    CANT_BROADCAST("cant_broadcast"),
}

/**
 * Bluetooth LE advertising with BluetoothLeAdvertiser (PLAN §6.5). Non-connectable,
 * no device name; the payload is the 15-byte beacon code under company ID 0xFFFF.
 * minSdk 23 can't update a running advert, so each new code restarts it.
 */
class Broadcaster(context: Context) {
    private val app = context.applicationContext
    private var callback: AdvertiseCallback? = null
    @Volatile var failed: Problem? = null
        private set

    companion object {
        /** Android 12+ needs "Nearby devices" (BLUETOOTH_ADVERTISE); before that, install-time permissions. */
        fun permissions(): Array<String> =
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) arrayOf(Manifest.permission.BLUETOOTH_ADVERTISE) else emptyArray()

        fun hasPermission(context: Context): Boolean =
            permissions().all { ContextCompat.checkSelfPermission(context, it) == PackageManager.PERMISSION_GRANTED }
    }

    /** Why it can't broadcast right now, or null if it can. */
    fun problem(): Problem? {
        val adapter = app.getSystemService(BluetoothManager::class.java)?.adapter ?: return Problem.CANT_BROADCAST
        if (!hasPermission(app)) return Problem.NO_PERMISSION
        if (!adapter.isEnabled) return Problem.BLUETOOTH_OFF
        if (!adapter.isMultipleAdvertisementSupported || adapter.bluetoothLeAdvertiser == null) return Problem.CANT_BROADCAST
        return failed
    }

    /** Broadcasts [payload] (replacing the previous code). */
    @SuppressLint("MissingPermission")
    fun advertise(payload: ByteArray, power: String) {
        stop()
        val advertiser = app.getSystemService(BluetoothManager::class.java)?.adapter?.bluetoothLeAdvertiser ?: return
        val settings = AdvertiseSettings.Builder()
            .setAdvertiseMode(AdvertiseSettings.ADVERTISE_MODE_LOW_LATENCY)
            .setTxPowerLevel(
                when (power) {
                    "LOW" -> AdvertiseSettings.ADVERTISE_TX_POWER_LOW
                    "HIGH" -> AdvertiseSettings.ADVERTISE_TX_POWER_HIGH
                    else -> AdvertiseSettings.ADVERTISE_TX_POWER_MEDIUM
                },
            )
            .setConnectable(false)
            .setTimeout(0)
            .build()
        val data = AdvertiseData.Builder()
            .addManufacturerData(BeaconCode.COMPANY_ID, payload)
            .setIncludeDeviceName(false)
            .setIncludeTxPowerLevel(false)
            .build()
        val cb = object : AdvertiseCallback() {
            override fun onStartSuccess(settingsInEffect: AdvertiseSettings) {
                failed = null
            }

            override fun onStartFailure(errorCode: Int) {
                // Too many advertisers / internal errors are retried with the next code.
                if (errorCode == ADVERTISE_FAILED_FEATURE_UNSUPPORTED || errorCode == ADVERTISE_FAILED_DATA_TOO_LARGE) failed = Problem.CANT_BROADCAST
            }
        }
        try {
            advertiser.startAdvertising(settings, data, cb)
            callback = cb
        } catch (e: SecurityException) {
            failed = Problem.NO_PERMISSION
        }
    }

    @SuppressLint("MissingPermission")
    fun stop() {
        val cb = callback ?: return
        callback = null
        runCatching { app.getSystemService(BluetoothManager::class.java)?.adapter?.bluetoothLeAdvertiser?.stopAdvertising(cb) }
    }

    val active: Boolean get() = callback != null
}
