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
    val ssid: String? = null,

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

@Database(entities = [AttemptEntity::class], version = 1, exportSchema = false)
abstract class AppDatabase : RoomDatabase() {
    abstract fun attempts(): AttemptDao

    companion object {
        fun create(context: Context) =
            Room.databaseBuilder(context, AppDatabase::class.java, "cse_attendance.db").build()
    }
}
