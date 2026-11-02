package lk.cse.attendance.ui

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.CheckCircle
import androidx.compose.material.icons.outlined.ErrorOutline
import androidx.compose.material.icons.outlined.Info
import androidx.compose.material.icons.outlined.Lightbulb
import androidx.compose.material.icons.outlined.WarningAmber
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.dp
import lk.cse.attendance.ui.theme.Lumora
import lk.cse.attendance.ui.theme.Spacing

/** "CSE Attendance" in Newsreader, "Attendance" muted. There is no logo mark. */
@Composable
fun BrandName(modifier: Modifier = Modifier) {
    Text(
        buildAnnotatedString {
            append("CSE ")
            withStyle(SpanStyle(color = Lumora.colors.inkMuted)) { append("Attendance") }
        },
        style = MaterialTheme.typography.headlineSmall.copy(fontSize = MaterialTheme.typography.titleLarge.fontSize),
        modifier = modifier,
    )
}

/** Flat card: surface, 1 dp line border, 10 dp corners. */
@Composable
fun LuCard(modifier: Modifier = Modifier, padding: Boolean = true, content: @Composable ColumnScope.() -> Unit) {
    Surface(
        modifier = modifier.fillMaxWidth(),
        shape = MaterialTheme.shapes.medium,
        color = Lumora.colors.surface,
        border = BorderStroke(1.dp, Lumora.colors.line),
    ) {
        Column(
            modifier = if (padding) Modifier.padding(14.dp) else Modifier,
            verticalArrangement = Arrangement.spacedBy(if (padding) 6.dp else 0.dp),
            content = content,
        )
    }
}

enum class Tone { Success, Warning, Danger, Info, Tip, Neutral, Brand }

private data class ToneColors(val fg: Color, val bg: Color)

@Composable
private fun toneColors(tone: Tone): ToneColors {
    val c = Lumora.colors
    return when (tone) {
        Tone.Success -> ToneColors(c.success, c.successSoft)
        Tone.Warning -> ToneColors(c.warning, c.warningSoft)
        Tone.Danger -> ToneColors(c.danger, c.dangerSoft)
        Tone.Info, Tone.Brand -> ToneColors(c.brand, c.brandSoft)
        Tone.Tip -> ToneColors(c.lumenInk, c.lumenSoft)
        Tone.Neutral -> ToneColors(c.inkMuted, c.surfaceSunken)
    }
}

/** Status badge. Always a word (and often an icon), never colour alone. */
@Composable
fun StatusBadge(text: String, tone: Tone, icon: ImageVector? = null) {
    val t = toneColors(tone)
    Row(
        modifier = Modifier
            .background(t.bg, MaterialTheme.shapes.extraSmall)
            .padding(horizontal = 6.dp, vertical = 1.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(4.dp),
    ) {
        if (icon != null) Icon(icon, contentDescription = null, tint = t.fg, modifier = Modifier.size(12.dp))
        Text(text, style = MaterialTheme.typography.labelSmall, color = t.fg)
    }
}

/** Notice box with an icon. `lead` is shown in bold before the text. */
@Composable
fun Notice(tone: Tone, text: String, lead: String? = null, modifier: Modifier = Modifier, action: (@Composable () -> Unit)? = null) {
    val t = toneColors(tone)
    val icon = when (tone) {
        Tone.Success -> Icons.Outlined.CheckCircle
        Tone.Warning -> Icons.Outlined.WarningAmber
        Tone.Danger -> Icons.Outlined.ErrorOutline
        Tone.Tip -> Icons.Outlined.Lightbulb
        else -> Icons.Outlined.Info
    }
    Row(
        modifier = modifier
            .fillMaxWidth()
            .background(t.bg, MaterialTheme.shapes.small)
            .padding(horizontal = 12.dp, vertical = 8.dp),
        horizontalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        Icon(icon, contentDescription = null, tint = t.fg, modifier = Modifier.padding(top = 2.dp).size(16.dp))
        Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Text(
                buildAnnotatedString {
                    if (lead != null) {
                        withStyle(SpanStyle(fontWeight = FontWeight.SemiBold, color = if (tone == Tone.Tip) t.fg else Lumora.colors.ink)) { append(lead) }
                        append(" ")
                    }
                    append(text)
                },
                style = MaterialTheme.typography.bodyMedium,
                color = Lumora.colors.ink,
            )
            action?.invoke()
        }
    }
}

/** The one primary button on a screen: 48 dp, full width. */
@Composable
fun PrimaryButton(text: String, onClick: () -> Unit, modifier: Modifier = Modifier, enabled: Boolean = true, busy: Boolean = false, icon: ImageVector? = null) {
    Button(
        onClick = onClick,
        enabled = enabled && !busy,
        modifier = modifier.fillMaxWidth().height(Spacing.buttonHeight),
        shape = MaterialTheme.shapes.small,
    ) {
        if (busy) {
            CircularProgressIndicator(Modifier.size(18.dp), strokeWidth = 2.dp, color = MaterialTheme.colorScheme.onPrimary)
            Spacer(Modifier.width(10.dp))
        } else if (icon != null) {
            Icon(icon, contentDescription = null, modifier = Modifier.size(18.dp))
            Spacer(Modifier.width(8.dp))
        }
        Text(text, style = MaterialTheme.typography.labelLarge)
    }
}

@Composable
fun SecondaryButton(text: String, onClick: () -> Unit, modifier: Modifier = Modifier, enabled: Boolean = true, danger: Boolean = false) {
    OutlinedButton(
        onClick = onClick,
        enabled = enabled,
        modifier = modifier.height(Spacing.buttonHeight),
        shape = MaterialTheme.shapes.small,
        border = BorderStroke(1.dp, if (danger) Lumora.colors.danger else Lumora.colors.lineStrong),
        colors = ButtonDefaults.outlinedButtonColors(contentColor = if (danger) Lumora.colors.danger else Lumora.colors.ink),
    ) {
        Text(text, style = MaterialTheme.typography.labelLarge)
    }
}

/** Thin progress bar (attendance %, registration count). */
@Composable
fun Meter(fraction: Float, color: Color = Lumora.colors.brand, modifier: Modifier = Modifier) {
    Box(
        modifier
            .fillMaxWidth()
            .height(6.dp)
            .background(Lumora.colors.surfaceSunken, RoundedCornerShape(999.dp)),
    ) {
        Box(
            Modifier
                .fillMaxWidth(fraction.coerceIn(0f, 1f))
                .height(6.dp)
                .background(color, RoundedCornerShape(999.dp)),
        )
    }
}

@Composable
fun Loading(modifier: Modifier = Modifier) {
    Box(modifier.fillMaxWidth().padding(32.dp), contentAlignment = Alignment.Center) {
        CircularProgressIndicator(color = Lumora.colors.brand)
    }
}
