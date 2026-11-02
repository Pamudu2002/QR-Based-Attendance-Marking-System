package lk.cse.attendance.ui

import androidx.compose.runtime.Composable
import androidx.compose.runtime.rememberCoroutineScope
import androidx.navigation.NavHostController
import androidx.navigation.NavType
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import androidx.navigation.navArgument
import lk.cse.attendance.MainActivity
import kotlinx.coroutines.launch
import lk.cse.attendance.data.AttemptDao
import lk.cse.attendance.data.CheckIns
import lk.cse.attendance.data.Session

/** Key on the register screen's saved state where a re-scan leaves the new code. */
const val RESCAN_RESULT = "rescan"

@Composable
fun AppNav(session: Session, checkIns: CheckIns, dao: AttemptDao, activity: MainActivity) {
    val nav = rememberNavController()
    // Outlives single screens, so a log write started as the scanner closes still finishes.
    val scope = rememberCoroutineScope()
    fun startOver(n: NavHostController) = n.navigate("setup") { popUpTo(0) { inclusive = true } }

    NavHost(nav, startDestination = if (session.isSetUp) "home" else "setup") {
        composable("setup") {
            SetupScreen(session, activity, onDone = { nav.navigate("home") { popUpTo("setup") { inclusive = true } } })
        }
        composable("home") {
            HomeScreen(
                session = session,
                activity = activity,
                onScan = { nav.navigate("scan") },
                onModule = { nav.navigate("module/$it") },
                onSettings = { nav.navigate("settings") },
                onSetUpAgain = { session.reset(); startOver(nav) },
                onExperiment = { nav.navigate("experiment") },
                onUpload = { checkIns.uploadInBackground() },
            )
        }
        composable(
            "scan?rescan={rescan}",
            arguments = listOf(navArgument("rescan") { type = NavType.BoolType; defaultValue = false }),
        ) { entry ->
            val rescan = entry.arguments?.getBoolean("rescan") == true
            val timeoutSec = session.prefs.scanTimeoutSec
            ScannerScreen(
                timeoutSec = timeoutSec,
                checkIns = !rescan,
                onClose = { nav.popBackStack() },
                onCheckInCode = { scan ->
                    checkIns.pending = scan
                    nav.navigate("checkin") { popUpTo("scan?rescan={rescan}") { inclusive = true } }
                },
                onNoDecode = { t0, stats, ssid -> scope.launch { checkIns.logNoDecode(t0, stats, ssid, timeoutSec) } },
                onClosedEarly = { t0, stats, ssid -> scope.launch { checkIns.logScannerClosed(t0, stats, ssid) } },
                onRegistrationCode = { token, decodedNanos ->
                    if (rescan) {
                        nav.previousBackStackEntry?.savedStateHandle?.set(RESCAN_RESULT, "$token:$decodedNanos")
                        nav.popBackStack()
                    } else {
                        nav.navigate("register/$token/$decodedNanos") { popUpTo("scan?rescan={rescan}") { inclusive = true } }
                    }
                },
            )
        }
        composable(
            "register/{token}/{scannedAt}",
            arguments = listOf(navArgument("token") { type = NavType.StringType }, navArgument("scannedAt") { type = NavType.LongType }),
        ) { entry ->
            RegisterScreen(
                session = session,
                activity = activity,
                initialToken = entry.arguments?.getString("token").orEmpty(),
                initialScannedAt = entry.arguments?.getLong("scannedAt") ?: 0L,
                rescanResult = entry.savedStateHandle.getStateFlow<String?>(RESCAN_RESULT, null),
                clearRescan = { entry.savedStateHandle[RESCAN_RESULT] = null },
                onRescan = { nav.navigate("scan?rescan=true") },
                onBack = { nav.popBackStack() },
                onDone = { nav.popBackStack("home", inclusive = false) },
                onSetUpAgain = { session.reset(); startOver(nav) },
            )
        }
        composable("checkin") {
            CheckInScreen(
                session = session,
                checkIns = checkIns,
                activity = activity,
                onDone = { nav.popBackStack("home", inclusive = false) },
                onScanAgain = { nav.navigate("scan") { popUpTo("checkin") { inclusive = true } } },
                onModule = { id -> nav.navigate("module/$id") { popUpTo("checkin") { inclusive = true } } },
                onSetUpAgain = { session.reset(); startOver(nav) },
            )
        }
        composable("experiment") {
            ExperimentSettingsScreen(session, dao, checkIns, onBack = { nav.popBackStack() }, onLog = { nav.navigate("log") })
        }
        composable("log") {
            AttemptLogScreen(dao, checkIns, onBack = { nav.popBackStack() })
        }
        composable("module/{id}", arguments = listOf(navArgument("id") { type = NavType.StringType })) { entry ->
            ModuleScreen(session, activity, moduleId = entry.arguments?.getString("id").orEmpty(), onBack = { nav.popBackStack() })
        }
        composable("settings") {
            SettingsScreen(session, activity, onBack = { nav.popBackStack() }, onLog = { nav.navigate("log") }, onSetUpAgain = { session.reset(); startOver(nav) })
        }
    }
}
