package lk.cse.attendance.beacon

import android.app.Application

/** CSE Attendance Beacon: holds the settings and the API client. */
class BeaconApp : Application() {
    lateinit var prefs: BeaconPrefs
        private set
    lateinit var api: BeaconApi
        private set

    val linked: Boolean get() = prefs.beaconId != null && BeaconKey.exists()

    override fun onCreate() {
        super.onCreate()
        prefs = BeaconPrefs(this)
        api = BeaconApi(prefs)
    }
}
