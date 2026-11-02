package lk.cse.attendance.data

import kotlinx.serialization.json.Json
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Test

/**
 * The app's JSON models against real server output (captured from POST /checkins
 * on the dev server). Same settings as Api.kt.
 */
class ContractTest {
    private val json = Json { ignoreUnknownKeys = true; explicitNulls = false; encodeDefaults = false }

    @Test fun readsACheckinReply() {
        val body = """{"attemptId":"d503f4ce-3384-48c0-916b-f35cade4d1b0","verdict":"DUPLICATE","attendance":null,"message":"You're already checked in to this class.","tokenAgeMs":7018,"seq":131,"issuedAt":"2026-11-02T00:04:31.613Z","receivedAt":"2026-11-02T00:04:38.631Z","serverTime":"2026-11-02T00:04:38.887Z","wifiOk":true,"windowId":"cmvyh6c4m000b5w7c92zsl1vv","intervalSec":10,"graceSec":2,"session":{"id":"cmvyh6acy00095w7clguj0cg1","title":"Lecture now","startsAt":"2026-11-01T23:37:36.905Z","endsAt":"2026-11-02T01:42:36.981Z","venue":"Lecture Hall A"},"module":{"id":"cmvy39csp0001qk7cbvk7wp9i","code":"CS4473","displayName":"In22-S7-CS4473 - Mobile Computing"},"summary":{"attended":1,"pastSessions":6,"attendancePct":17}}"""
        val r = json.decodeFromString(CheckinResponse.serializer(), body)
        assertEquals("DUPLICATE", r.verdict)
        assertNull(r.attendance)
        assertEquals(7018, r.tokenAgeMs)
        assertEquals(12, (r.intervalSec ?: 0) + (r.graceSec ?: 0))
        assertEquals("CS4473", r.module?.code)
        assertEquals(17, r.summary?.attendancePct)
    }

    @Test fun readsARejectionWithoutSession() {
        val body = """{"attemptId":"a","verdict":"BAD_TOKEN","attendance":null,"message":"That isn't a check-in code for an open class.","tokenAgeMs":null,"seq":null,"issuedAt":null,"receivedAt":"2026-11-02T00:04:38.631Z","serverTime":"2026-11-02T00:04:38.887Z","wifiOk":null,"windowId":null,"intervalSec":null,"graceSec":null,"session":null,"module":null,"summary":null}"""
        val r = json.decodeFromString(CheckinResponse.serializer(), body)
        assertEquals("BAD_TOKEN", r.verdict)
        assertNull(r.session)
    }

    @Test fun sendsTheBeaconCodesHeardWithACheckIn() {
        val heard = BeaconHeard(data = "Q0EBAAAAB/XAfS7oIXXX", rssi = -64, heardAgoMs = 412.5)
        val out = json.encodeToString(CheckinRequest.serializer(), CheckinRequest(token = "QA1:C:x", attemptId = "a", signature = "s", beacons = listOf(heard)))
        assertEquals("""{"token":"QA1:C:x","attemptId":"a","signature":"s","beacons":[{"data":"Q0EBAAAAB/XAfS7oIXXX","rssi":-64,"heardAgoMs":412.5}]}""", out)
        // Nothing heard: the field is left out, as the server's default is an empty list.
        assertFalse(json.encodeToString(CheckinRequest.serializer(), CheckinRequest(token = "t", attemptId = "a", signature = "s")).contains("beacons"))
    }

    @Test fun readsTheBeaconVerdict() {
        val body = """{"attemptId":"a","verdict":"NO_BEACON","attendance":null,"message":"Classroom beacon not found. Turn on Bluetooth and move closer to the front, then scan again.","tokenAgeMs":1896,"seq":0,"beaconOk":null,"receivedAt":"2026-11-02T05:23:51.000Z","serverTime":"2026-11-02T05:23:51.100Z","session":null,"module":null,"summary":null}"""
        val r = json.decodeFromString(CheckinResponse.serializer(), body)
        assertEquals("NO_BEACON", r.verdict)
        assertNull(r.beaconOk)
    }

    @Test fun leavesOutEmptyFieldsWhenUploading() {
        val out = json.encodeToString(AttemptUploadRequest.serializer(), AttemptUploadRequest(listOf(AttemptUpload(id = "x", postRttMs = 312.5, totalMs = 2400.0))))
        assertEquals("""{"attempts":[{"id":"x","postRttMs":312.5,"totalMs":2400.0}]}""", out)
        assertFalse(out.contains("verdict"))
    }
}
