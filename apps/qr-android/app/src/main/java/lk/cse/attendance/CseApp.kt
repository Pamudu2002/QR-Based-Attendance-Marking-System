package lk.cse.attendance

import android.app.Application
import lk.cse.attendance.data.Api
import lk.cse.attendance.data.AppDatabase
import lk.cse.attendance.data.CheckIns
import lk.cse.attendance.data.Prefs
import lk.cse.attendance.data.Session

/** Holds the app-wide objects. */
class CseApp : Application() {
    lateinit var session: Session
        private set
    lateinit var checkIns: CheckIns
        private set
    lateinit var db: AppDatabase
        private set

    override fun onCreate() {
        super.onCreate()
        val prefs = Prefs(this)
        session = Session(this, prefs, Api(prefs))
        db = AppDatabase.create(this)
        checkIns = CheckIns(session, db.attempts())
    }
}
