package lk.cse.attendance.ui.theme

import androidx.compose.runtime.Immutable
import androidx.compose.ui.graphics.Color

/**
 * Lumora colours for CSE Attendance (from design/tokens/lumora.tokens.json).
 * Change the package name above to match your app.
 *
 * - brand (teal) = primary buttons, links, active items.
 * - lumen (amber) = tips and highlights only (a fill, never text on light surfaces).
 * - success / warning / danger = statuses and messages. Always show them with an icon or a word.
 */
@Immutable
data class LumoraColors(
    val canvas: Color,
    val surface: Color,
    val surfaceSunken: Color,
    val surfaceRaised: Color,
    val line: Color,
    val lineStrong: Color,
    val ink: Color,
    val inkMuted: Color,
    val brand: Color,
    val brandHover: Color,
    val brandSoft: Color,
    val onBrand: Color,
    val selected: Color,
    val focus: Color,
    val lumen: Color,
    val lumenSoft: Color,
    val lumenInk: Color,
    val onLumen: Color,
    val success: Color,
    val successSoft: Color,
    val warning: Color,
    val warningSoft: Color,
    val danger: Color,
    val dangerSoft: Color,
    val paper: Color = Color(0xFFFFFFFF),
)

val LightLumoraColors = LumoraColors(
    canvas = Color(0xFFE8EAE6),
    surface = Color(0xFFFFFFFF),
    surfaceSunken = Color(0xFFF4F5F2),
    surfaceRaised = Color(0xFFFFFFFF),
    line = Color(0xFFE0E3DE),
    lineStrong = Color(0xFF868E89),
    ink = Color(0xFF141B1C),
    inkMuted = Color(0xFF545F61),
    brand = Color(0xFF0D6767),
    brandHover = Color(0xFF0A5656),
    brandSoft = Color(0xFFDCEFEC),
    onBrand = Color(0xFFFFFFFF),
    selected = Color(0xFFE3F1EF),
    focus = Color(0xFF0D6767),
    lumen = Color(0xFFE8A13A),
    lumenSoft = Color(0xFFFBEED6),
    lumenInk = Color(0xFF7A4807),
    onLumen = Color(0xFF2A1B05),
    success = Color(0xFF1D7346),
    successSoft = Color(0xFFDDF1E4),
    warning = Color(0xFF8F5400),
    warningSoft = Color(0xFFFCEFD6),
    danger = Color(0xFFB42318),
    dangerSoft = Color(0xFFFDE4E1),
)

val DarkLumoraColors = LumoraColors(
    canvas = Color(0xFF0D1112),
    surface = Color(0xFF161B1C),
    surfaceSunken = Color(0xFF121718),
    surfaceRaised = Color(0xFF1E2526),
    line = Color(0xFF2A3233),
    lineStrong = Color(0xFF66726F),
    ink = Color(0xFFE7ECEB),
    inkMuted = Color(0xFF9EAAAB),
    brand = Color(0xFF5CC4BD),
    brandHover = Color(0xFF7DD3CD),
    brandSoft = Color(0xFF13302E),
    onBrand = Color(0xFF071615),
    selected = Color(0xFF163331),
    focus = Color(0xFF6FD0C9),
    lumen = Color(0xFFF0B45A),
    lumenSoft = Color(0xFF3A2A10),
    lumenInk = Color(0xFFF0B45A),
    onLumen = Color(0xFF2A1B05),
    success = Color(0xFF5FCA8E),
    successSoft = Color(0xFF11291B),
    warning = Color(0xFFF0B54A),
    warningSoft = Color(0xFF33240A),
    danger = Color(0xFFF8806F),
    dangerSoft = Color(0xFF3A1512),
)
