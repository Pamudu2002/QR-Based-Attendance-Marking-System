package lk.cse.attendance.ui.theme

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Shapes
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.ReadOnlyComposable
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp

/** Lumora corner radii: sm 4 (badges), md 6 (buttons, inputs), lg 10 (cards, sheets). */
val CseShapes = Shapes(
    extraSmall = RoundedCornerShape(4.dp),
    small = RoundedCornerShape(6.dp),
    medium = RoundedCornerShape(10.dp),
    large = RoundedCornerShape(16.dp),
    extraLarge = RoundedCornerShape(16.dp),
)

/** Spacing on a 4 dp grid. Touch targets are at least 44 dp. */
object Spacing {
    val s1 = 4.dp; val s2 = 8.dp; val s3 = 12.dp; val s4 = 16.dp
    val s5 = 20.dp; val s6 = 24.dp; val s8 = 32.dp; val s10 = 40.dp
    val touchTarget = 44.dp
    val buttonHeight = 48.dp
}

private val LocalLumoraColors = staticCompositionLocalOf { LightLumoraColors }

/** Access the full Lumora palette (status colours, lumen, line, etc.): `Lumora.colors.success` */
object Lumora {
    val colors: LumoraColors
        @Composable @ReadOnlyComposable
        get() = LocalLumoraColors.current
}

/**
 * Wrap the whole app in this. Follows the phone's dark mode by default;
 * pass darkTheme from the in-app Appearance setting (Light / Dark) to override it.
 */
@Composable
fun CseAttendanceTheme(
    darkTheme: Boolean = isSystemInDarkTheme(),
    content: @Composable () -> Unit,
) {
    val lu = if (darkTheme) DarkLumoraColors else LightLumoraColors
    val scheme = if (darkTheme) {
        darkColorScheme(
            primary = lu.brand, onPrimary = lu.onBrand,
            primaryContainer = lu.brandSoft, onPrimaryContainer = lu.ink,
            secondary = lu.lumen, onSecondary = lu.onLumen,
            secondaryContainer = lu.lumenSoft, onSecondaryContainer = lu.ink,
            background = lu.surfaceSunken, onBackground = lu.ink,
            surface = lu.surface, onSurface = lu.ink,
            surfaceVariant = lu.surfaceSunken, onSurfaceVariant = lu.inkMuted,
            surfaceContainer = lu.surface, surfaceContainerHigh = lu.surfaceRaised,
            outline = lu.lineStrong, outlineVariant = lu.line,
            error = lu.danger, onError = Color(0xFF2A0A06),
            errorContainer = lu.dangerSoft, onErrorContainer = lu.ink,
        )
    } else {
        lightColorScheme(
            primary = lu.brand, onPrimary = lu.onBrand,
            primaryContainer = lu.brandSoft, onPrimaryContainer = lu.ink,
            secondary = lu.lumen, onSecondary = lu.onLumen,
            secondaryContainer = lu.lumenSoft, onSecondaryContainer = lu.ink,
            background = lu.surfaceSunken, onBackground = lu.ink,
            surface = lu.surface, onSurface = lu.ink,
            surfaceVariant = lu.surfaceSunken, onSurfaceVariant = lu.inkMuted,
            surfaceContainer = lu.surface, surfaceContainerHigh = lu.surfaceRaised,
            outline = lu.lineStrong, outlineVariant = lu.line,
            error = lu.danger, onError = Color.White,
            errorContainer = lu.dangerSoft, onErrorContainer = lu.ink,
        )
    }
    CompositionLocalProvider(LocalLumoraColors provides lu) {
        MaterialTheme(colorScheme = scheme, typography = CseTypography, shapes = CseShapes, content = content)
    }
}
