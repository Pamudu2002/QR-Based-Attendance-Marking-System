package lk.cse.attendance.ui.theme

import androidx.compose.material3.Typography
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.Font
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.em
import androidx.compose.ui.unit.sp
import lk.cse.attendance.R

/**
 * Lumora type for the phone app.
 * - Interface text uses the system font (Roboto on most Android phones).
 * - Newsreader (serif) is only for "brand moments": the app name, greetings, big result titles.
 *   Download Newsreader Medium (SIL Open Font License) from Google Fonts and save it as
 *   app/src/main/res/font/newsreader_medium.ttf
 * - Monospace is for index numbers, timings and codes.
 * Sizes are a little larger than the desktop Lumora scale so they are easy to read on a phone.
 */
val Newsreader = FontFamily(Font(R.font.newsreader_medium, FontWeight.Medium))
val LumoraMono = FontFamily.Monospace

val CseTypography = Typography(
    // Brand moments (Newsreader)
    displaySmall = TextStyle(fontFamily = Newsreader, fontWeight = FontWeight.Medium, fontSize = 30.sp, lineHeight = 36.sp),
    headlineSmall = TextStyle(fontFamily = Newsreader, fontWeight = FontWeight.Medium, fontSize = 28.sp, lineHeight = 34.sp),
    // Screen and section titles
    titleLarge = TextStyle(fontWeight = FontWeight.SemiBold, fontSize = 20.sp, lineHeight = 28.sp, letterSpacing = (-0.01).em),
    titleMedium = TextStyle(fontWeight = FontWeight.SemiBold, fontSize = 17.sp, lineHeight = 24.sp),
    titleSmall = TextStyle(fontWeight = FontWeight.SemiBold, fontSize = 15.sp, lineHeight = 22.sp),
    // Body
    bodyLarge = TextStyle(fontWeight = FontWeight.Normal, fontSize = 16.sp, lineHeight = 24.sp),
    bodyMedium = TextStyle(fontWeight = FontWeight.Normal, fontSize = 14.sp, lineHeight = 20.sp),
    bodySmall = TextStyle(fontWeight = FontWeight.Normal, fontSize = 12.sp, lineHeight = 16.sp),
    // Labels, badges, captions
    labelLarge = TextStyle(fontWeight = FontWeight.SemiBold, fontSize = 15.sp, lineHeight = 20.sp),
    labelMedium = TextStyle(fontWeight = FontWeight.Medium, fontSize = 12.sp, lineHeight = 16.sp),
    labelSmall = TextStyle(fontWeight = FontWeight.SemiBold, fontSize = 11.sp, lineHeight = 16.sp),
)

/** For index numbers ("220366X"), timings ("1.8 s") and codes. */
val MonoText = TextStyle(fontFamily = LumoraMono, fontSize = 12.sp, lineHeight = 18.sp)
