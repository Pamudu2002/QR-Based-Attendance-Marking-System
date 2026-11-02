package lk.cse.attendance.ui

import android.os.SystemClock
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.outlined.ArrowBack
import androidx.compose.material.icons.outlined.Fingerprint
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableLongStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardCapitalization
import androidx.compose.ui.unit.dp
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch
import lk.cse.attendance.MainActivity
import lk.cse.attendance.core.Identity
import lk.cse.attendance.core.QrPayload
import lk.cse.attendance.core.SignedMessages
import lk.cse.attendance.data.ApiException
import lk.cse.attendance.data.MeResponse
import lk.cse.attendance.data.NeedsLoginException
import lk.cse.attendance.data.PreviewResponse
import lk.cse.attendance.data.RegisterRequest
import lk.cse.attendance.data.RegisterResponse
import lk.cse.attendance.data.Session
import lk.cse.attendance.security.AuthCancelledException
import lk.cse.attendance.ui.theme.Lumora
import lk.cse.attendance.ui.theme.MonoText

/**
 * The registration code is accepted for T + 2 s = 32 s after it appears. Typing
 * takes longer than that, so a code older than this is scanned again just
 * before signing, which keeps the server's accept rule unchanged.
 */
private const val FRESH_MS = 20_000L

/** Register for a module (design/screens/AppRegister.dc.html). */
@Composable
fun RegisterScreen(
    session: Session,
    activity: MainActivity,
    initialToken: String,
    initialScannedAt: Long,
    rescanResult: StateFlow<String?>,
    clearRescan: () -> Unit,
    onRescan: () -> Unit,
    onBack: () -> Unit,
    onDone: () -> Unit,
    onSetUpAgain: () -> Unit,
) {
    val scope = rememberCoroutineScope()
    var token by rememberSaveable { mutableStateOf(initialToken) }
    var scannedAt by rememberSaveable { mutableLongStateOf(initialScannedAt) }
    var index by rememberSaveable { mutableStateOf("") }
    var name by rememberSaveable { mutableStateOf("") }
    var submitAfterRescan by rememberSaveable { mutableStateOf(false) }

    var me by remember { mutableStateOf<MeResponse?>(null) }
    var preview by remember { mutableStateOf<PreviewResponse?>(null) }
    var loading by remember { mutableStateOf(true) }
    var needsLogin by remember { mutableStateOf(false) }
    var revoked by remember { mutableStateOf(false) }
    var busy by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }
    var indexError by remember { mutableStateOf<String?>(null) }
    var nameError by remember { mutableStateOf<String?>(null) }
    var done by remember { mutableStateOf<RegisterResponse?>(null) }
    var reload by remember { mutableIntStateOf(0) }

    val bound = me?.student
    val api = session.api

    fun handle(e: Exception) {
        when {
            e is NeedsLoginException -> needsLogin = true
            e is ApiException && e.isRevoked -> revoked = true
            e is AuthCancelledException -> error = null
            else -> error = friendlyMessage(e)
        }
    }

    // Load who this phone is and what the code is for.
    LaunchedEffect(reload) {
        loading = true
        error = null
        try {
            me = api.me()
            preview = api.previewRegistration(QrPayload.Registration(token).text)
            needsLogin = false
        } catch (e: Exception) {
            handle(e)
        } finally {
            loading = false
        }
    }

    fun submit() {
        val p = preview ?: return
        val module = p.module ?: return
        indexError = null
        nameError = null
        error = null

        val idx = bound?.indexNumber ?: Identity.normaliseIndex(index)
        if (bound == null) {
            if (!Identity.isValidIndex(idx)) indexError = "Index must be 6 digits and a letter, e.g. 220366X."
            if (Identity.cleanName(name).isEmpty()) nameError = "Enter your name as it is on the class list."
            if (indexError != null || nameError != null) return
        }

        val ageMs = (SystemClock.elapsedRealtimeNanos() - scannedAt) / 1_000_000
        if (ageMs > FRESH_MS) {
            submitAfterRescan = true
            onRescan()
            return
        }

        val deviceId = session.deviceId ?: return
        busy = true
        scope.launch {
            try {
                val signed = session.userAuth(activity).sign(
                    SignedMessages.registration(token, deviceId, idx),
                    title = "Register for ${module.shortName}",
                    subtitle = "Confirm it's you, ${idx}",
                )
                val res = api.register(
                    RegisterRequest(
                        token = QrPayload.Registration(token).text,
                        indexNumber = if (bound == null) idx else null,
                        name = if (bound == null) Identity.cleanName(name) else null,
                        signature = signed.signature,
                    ),
                )
                when (res.verdict) {
                    "REGISTERED", "ALREADY_REGISTERED" -> done = res
                    "NAME_MISMATCH" -> nameError = "This name doesn't match the class list for $idx. Check the spelling, or ask your lecturer."
                    "NOT_ON_ROSTER" -> indexError = res.message
                    "EXPIRED", "BAD_TOKEN" -> {
                        error = res.message
                        submitAfterRescan = true
                        onRescan()
                    }
                    else -> error = res.message
                }
            } catch (e: Exception) {
                handle(e)
            } finally {
                busy = false
            }
        }
    }

    // A fresh code from the scanner: check it's the same module, then finish.
    val rescanned by rescanResult.collectAsState()
    LaunchedEffect(rescanned) {
        val value = rescanned ?: return@LaunchedEffect
        clearRescan()
        val (t, nanos) = value.split(":").let { it[0] to (it.getOrNull(1)?.toLongOrNull() ?: 0L) }
        val previousModule = preview?.module?.id
        token = t
        scannedAt = nanos
        try {
            val p = api.previewRegistration(QrPayload.Registration(t).text)
            if (p.module?.id != previousModule) {
                error = "That code is for a different module. Scan the code for ${preview?.module?.displayName ?: "this module"}."
                submitAfterRescan = false
                return@LaunchedEffect
            }
            preview = p
        } catch (e: Exception) {
            handle(e)
            return@LaunchedEffect
        }
        if (submitAfterRescan) {
            submitAfterRescan = false
            submit()
        }
    }

    Column(
        Modifier
            .fillMaxSize()
            .background(Lumora.colors.surfaceSunken)
            .statusBarsPadding()
            .navigationBarsPadding()
            .imePadding()
            .verticalScroll(rememberScrollState())
            .padding(start = 20.dp, end = 20.dp, top = 12.dp, bottom = 24.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp),
    ) {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            IconButton(onClick = onBack) { Icon(Icons.AutoMirrored.Outlined.ArrowBack, contentDescription = "Back") }
            Text("Register for a module", style = MaterialTheme.typography.titleMedium)
        }

        when {
            revoked -> {
                Notice(Tone.Danger, "Your lecturer reset this phone. Set up the app again to register it.", lead = "This phone was reset.") {
                    SecondaryButton("Set up again", onClick = onSetUpAgain)
                }
                return@Column
            }
            needsLogin -> {
                Notice(Tone.Info, "Unlock the app with your fingerprint or PIN to continue.") {
                    SecondaryButton("Confirm it's you", onClick = {
                        scope.launch {
                            try {
                                session.logIn(activity)
                                needsLogin = false
                                reload++
                            } catch (e: Exception) {
                                handle(e)
                            }
                        }
                    })
                }
                return@Column
            }
            loading && preview == null -> {
                Loading()
                return@Column
            }
        }

        val p = preview
        if (p == null) {
            error?.let { Notice(Tone.Danger, it) }
            SecondaryButton("Scan again", onClick = onBack, modifier = Modifier.fillMaxWidth())
            return@Column
        }

        val module = p.module
        when {
            done != null -> Notice(Tone.Success, done!!.message, lead = if (done!!.verdict == "REGISTERED") "Registered." else "Already registered.")
            p.verdict == "OK" -> Notice(Tone.Success, "Registration is open for this module.", lead = "Registration QR read.")
            else -> Notice(Tone.Danger, p.message)
        }

        if (module != null) {
            LuCard {
                Text(module.shortName, style = MonoText, color = Lumora.colors.inkMuted)
                Text(module.name, style = MaterialTheme.typography.titleMedium)
                Text(module.lecturer, style = MaterialTheme.typography.bodyMedium, color = Lumora.colors.inkMuted)
            }
        }

        if (done != null || p.alreadyRegistered) {
            if (done == null) Notice(Tone.Success, "You're already registered for this module.")
            PrimaryButton("Go to my modules", onClick = onDone)
            return@Column
        }
        if (p.verdict != "OK" || module == null) {
            SecondaryButton("Scan again", onClick = onBack, modifier = Modifier.fillMaxWidth())
            return@Column
        }

        if (bound == null) {
            Column(verticalArrangement = Arrangement.spacedBy(14.dp)) {
                OutlinedTextField(
                    value = index,
                    onValueChange = { index = it.uppercase().take(7); indexError = null },
                    label = { Text("Index number") },
                    singleLine = true,
                    isError = indexError != null,
                    supportingText = indexError?.let { { Text(it) } },
                    textStyle = MaterialTheme.typography.bodyLarge.copy(fontFamily = MonoText.fontFamily),
                    keyboardOptions = KeyboardOptions(capitalization = KeyboardCapitalization.Characters, autoCorrectEnabled = false, imeAction = ImeAction.Next),
                    modifier = Modifier.fillMaxWidth(),
                )
                OutlinedTextField(
                    value = name,
                    onValueChange = { name = it; nameError = null },
                    label = { Text("Name") },
                    singleLine = true,
                    isError = nameError != null,
                    supportingText = nameError?.let { { Text(it) } },
                    keyboardOptions = KeyboardOptions(capitalization = KeyboardCapitalization.Words, autoCorrectEnabled = false, imeAction = ImeAction.Done),
                    modifier = Modifier.fillMaxWidth(),
                )
                Text(
                    "Type both exactly as on your lecturer's class list. Capitals, spaces and dots don't matter.",
                    style = MaterialTheme.typography.bodyMedium,
                    color = Lumora.colors.inkMuted,
                )
            }
            val linkTo = Identity.normaliseIndex(index).ifEmpty { "your index number" }
            Notice(Tone.Tip, "This phone will be linked to $linkTo. If you change phones, ask your lecturer to reset it.", lead = "One phone, one student.")
        } else {
            val shownName = p.nameOnList ?: bound.name ?: ""
            if (p.nameOnList == null) {
                Notice(Tone.Warning, "Your index number ${bound.indexNumber} is not on this module's list. Ask your lecturer to add you.")
            } else {
                LuCard {
                    Text("Register for ${module.displayName} as ${shownName.uppercase()} (${bound.indexNumber})?", style = MaterialTheme.typography.bodyLarge)
                }
            }
        }

        error?.let { Notice(Tone.Danger, it) }

        PrimaryButton(
            "Confirm with fingerprint or PIN",
            onClick = ::submit,
            busy = busy,
            enabled = bound == null || p.nameOnList != null,
            icon = Icons.Outlined.Fingerprint,
        )
    }
}
