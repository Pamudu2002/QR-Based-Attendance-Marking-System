package lk.cse.attendance.data

import android.content.Context
import android.location.LocationManager
import android.net.ConnectivityManager
import android.net.Network
import android.net.NetworkCapabilities
import android.net.NetworkRequest
import android.net.wifi.WifiInfo
import android.net.wifi.WifiManager
import android.os.Build
import androidx.annotation.RequiresApi
import androidx.core.location.LocationManagerCompat
import kotlin.coroutines.resume
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlinx.coroutines.withTimeoutOrNull

/**
 * The Wi-Fi name (SSID), per Android version (PLAN §6.5):
 *  6.0–8.0: ACCESS_WIFI_STATE only · 8.1: + a location permission
 *  9: + location services on · 10+: ACCESS_FINE_LOCATION + location services on.
 * If a requirement is missing Android returns "<unknown ssid>", logged as UNKNOWN.
 */
object WifiReader {
    const val UNKNOWN = "UNKNOWN"

    data class Reading(val ssid: String, val locationOff: Boolean)

    suspend fun read(context: Context): Reading {
        val app = context.applicationContext
        val locationOff = Build.VERSION.SDK_INT >= Build.VERSION_CODES.P && !LocationManagerCompat.isLocationEnabled(app.getSystemService(LocationManager::class.java))
        val ssid = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            fromNetworkCallback(app) ?: fromWifiManager(app)
        } else {
            fromWifiManager(app)
        }
        return Reading(ssid, locationOff)
    }

    fun normalise(raw: String?): String {
        val t = raw?.trim()?.removeSurrounding("\"").orEmpty()
        return if (t.isEmpty() || t == "<unknown ssid>" || t == WifiManager.UNKNOWN_SSID) UNKNOWN else t
    }

    private fun fromWifiManager(context: Context): String {
        val wifi = context.getSystemService(WifiManager::class.java) ?: return UNKNOWN
        @Suppress("DEPRECATION")
        return normalise(runCatching { wifi.connectionInfo?.ssid }.getOrNull())
    }

    /** Android 12+: the location-aware callback gives the SSID that getConnectionInfo() may redact. */
    @RequiresApi(Build.VERSION_CODES.S)
    private suspend fun fromNetworkCallback(context: Context): String? {
        val cm = context.getSystemService(ConnectivityManager::class.java) ?: return null
        return withTimeoutOrNull(1500) {
            suspendCancellableCoroutine { cont ->
                val callback = object : ConnectivityManager.NetworkCallback(FLAG_INCLUDE_LOCATION_INFO) {
                    override fun onCapabilitiesChanged(network: Network, caps: NetworkCapabilities) {
                        val info = caps.transportInfo as? WifiInfo ?: return
                        runCatching { cm.unregisterNetworkCallback(this) }
                        if (cont.isActive) cont.resume(normalise(info.ssid))
                    }
                }
                val request = NetworkRequest.Builder().addTransportType(NetworkCapabilities.TRANSPORT_WIFI).build()
                runCatching { cm.registerNetworkCallback(request, callback) }.onFailure { if (cont.isActive) cont.resume(null) }
                cont.invokeOnCancellation { runCatching { cm.unregisterNetworkCallback(callback) } }
            }
        }
    }
}
