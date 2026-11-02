package lk.cse.attendance.data

import android.content.Context
import androidx.room.Dao
import androidx.room.Database
import androidx.room.Entity
import androidx.room.PrimaryKey
import androidx.room.Query
import androidx.room.Room
import androidx.room.RoomDatabase
import androidx.room.Upsert
import androidx.room.migration.Migration
import androidx.sqlite.db.SupportSQLiteDatabase
import kotlinx.coroutines.flow.Flow

/**
 * One check-in attempt, saved on the phone before anything is sent (PLAN §5.2).
 * Timings come from SystemClock.elapsedRealtimeNanos and are stored in ms.
 */
@Entity(tableName = "attempts")
data class AttemptEntity(
    @PrimaryKey val id: String,
    /** Wall-clock time, only for showing the log. Never used for durations. */
    val createdAtMs: Long,
    /** The decoded check-in token (without QA1:C:), if a code was read. */
    val token: String? = null,

    // Run-sheet labels (experiment settings)
    val phoneLabel: String? = null,
    val distanceRow: String? = null,
    val distanceM: Double? = null,
    val role: String? = null,
    val runNo: Int? = null,
    val attemptNo: Int? = null,

    // Client timings
    val firstFrameMs: Double? = null,
    val decodeMs: Double? = null,
    val framesProcessed: Int? = null,
    val framesDropped: Int? = null,
    val biometricMs: Double? = null,
    val postRttMs: Double? = null,
    val totalMs: Double? = null,
    val authMethod: String? = null,
    val androidSdk: Int,
    /** Strongest classroom beacon heard (dBm), and the server's verdict on it (PLAN §6.5). */
    val beaconRssi: Int? = null,
    val beaconOk: Boolean? = null,

    /** Server verdict, or NO_DECODE / CANCELLED / NETWORK_ERROR / PENDING decided on the phone. */
    val verdict: String,
    val attendance: String? = null,
    val reason: String? = null,
    val tokenAgeMs: Int? = null,
    val seq: Int? = null,
    /** POST /checkins got a reply, so the server already has this attempt. */
    val sentToServer: Boolean = false,
    /** The full record (with postRttMs and totalMs) went up through /attempts/bulk. */
    val uploaded: Boolean = false,
)

@Dao
interface AttemptDao {
    @Upsert
    suspend fun upsert(attempt: AttemptEntity)

    @Query("SELECT * FROM attempts WHERE id = :id")
    suspend fun get(id: String): AttemptEntity?

    @Query("SELECT * FROM attempts ORDER BY createdAtMs DESC LIMIT 300")
    fun recent(): Flow<List<AttemptEntity>>

    @Query("SELECT * FROM attempts WHERE uploaded = 0 AND verdict != 'PENDING' ORDER BY createdAtMs LIMIT 500")
    suspend fun pending(): List<AttemptEntity>

    @Query("SELECT COUNT(*) FROM attempts WHERE uploaded = 0 AND verdict != 'PENDING'")
    fun pendingCount(): Flow<Int>

    @Query("UPDATE attempts SET uploaded = 1 WHERE id IN (:ids)")
    suspend fun markUploaded(ids: List<String>)
}

@Database(entities = [AttemptEntity::class], version = 3, exportSchema = false)
abstract class AppDatabase : RoomDatabase() {
    abstract fun attempts(): AttemptDao

    companion object {
        // Migrations keep the log: unsent attempts must survive an app update.

        /** v2 added the Wi-Fi router address (since removed). */
        private val V1_TO_V2 = object : Migration(1, 2) {
            override fun migrate(db: SupportSQLiteDatabase) {
                db.execSQL("ALTER TABLE attempts ADD COLUMN bssid TEXT")
            }
        }

        /** v3 drops the Wi-Fi columns and adds the classroom beacon (PLAN §6.5). SQLite rebuilds the table. */
        private val V2_TO_V3 = object : Migration(2, 3) {
            override fun migrate(db: SupportSQLiteDatabase) {
                db.execSQL(
                    "CREATE TABLE IF NOT EXISTS `attempts_new` (`id` TEXT NOT NULL, `createdAtMs` INTEGER NOT NULL, `token` TEXT, " +
                        "`phoneLabel` TEXT, `distanceRow` TEXT, `distanceM` REAL, `role` TEXT, `runNo` INTEGER, `attemptNo` INTEGER, " +
                        "`firstFrameMs` REAL, `decodeMs` REAL, `framesProcessed` INTEGER, `framesDropped` INTEGER, `biometricMs` REAL, " +
                        "`postRttMs` REAL, `totalMs` REAL, `authMethod` TEXT, `androidSdk` INTEGER NOT NULL, `beaconRssi` INTEGER, " +
                        "`beaconOk` INTEGER, `verdict` TEXT NOT NULL, `attendance` TEXT, `reason` TEXT, `tokenAgeMs` INTEGER, `seq` INTEGER, " +
                        "`sentToServer` INTEGER NOT NULL, `uploaded` INTEGER NOT NULL, PRIMARY KEY(`id`))",
                )
                val cols = "`id`, `createdAtMs`, `token`, `phoneLabel`, `distanceRow`, `distanceM`, `role`, `runNo`, `attemptNo`, `firstFrameMs`, `decodeMs`, `framesProcessed`, `framesDropped`, `biometricMs`, `postRttMs`, `totalMs`, `authMethod`, `androidSdk`, `verdict`, `attendance`, `reason`, `tokenAgeMs`, `seq`, `sentToServer`, `uploaded`"
                db.execSQL("INSERT INTO `attempts_new` ($cols) SELECT $cols FROM `attempts`")
                db.execSQL("DROP TABLE `attempts`")
                db.execSQL("ALTER TABLE `attempts_new` RENAME TO `attempts`")
            }
        }

        fun create(context: Context) =
            Room.databaseBuilder(context, AppDatabase::class.java, "cse_attendance.db").addMigrations(V1_TO_V2, V2_TO_V3).build()
    }
}
