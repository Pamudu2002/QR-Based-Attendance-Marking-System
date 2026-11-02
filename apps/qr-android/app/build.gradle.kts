plugins {
    alias(libs.plugins.android.application)
    alias(libs.plugins.kotlin.android)
    alias(libs.plugins.kotlin.compose)
    alias(libs.plugins.kotlin.serialization)
    alias(libs.plugins.ksp)
}

android {
    namespace = "lk.cse.attendance"
    compileSdk = 36

    defaultConfig {
        applicationId = "lk.cse.attendance"
        minSdk = 23
        targetSdk = 35
        versionCode = 2
        versionName = "0.4.0"
        // Default server; editable in Settings.
        buildConfigField("String", "SERVER_URL", "\"https://qr-based-attendance-marking-system.vercel.app\"")
    }

    // Two apps from one codebase (PLAN §5, §6.5): the student app, and CSE Attendance
    // Beacon for the lecturer's phone. Shared code is in src/main; each has its own
    // manifest (permissions, entry point) in src/student and src/beacon.
    flavorDimensions += "role"
    productFlavors {
        create("student") {
            dimension = "role"
            applicationId = "lk.cse.attendance"
        }
        create("beacon") {
            dimension = "role"
            applicationId = "lk.cse.attendance.beacon"
        }
    }

    buildTypes {
        release {
            isMinifyEnabled = false
            proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"), "proguard-rules.pro")
        }
    }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
        // java.time on Android 6–7
        isCoreLibraryDesugaringEnabled = true
    }
    buildFeatures {
        compose = true
        buildConfig = true
    }
}

kotlin {
    compilerOptions {
        jvmTarget.set(org.jetbrains.kotlin.gradle.dsl.JvmTarget.JVM_17)
    }
}

dependencies {
    implementation(libs.androidx.core.ktx)
    implementation(libs.androidx.activity.compose)
    implementation(libs.androidx.lifecycle.runtime.compose)
    implementation(libs.androidx.lifecycle.viewmodel.compose)
    implementation(libs.androidx.navigation.compose)
    // BiometricPrompt needs a FragmentActivity; pin a current fragment.
    implementation(libs.androidx.fragment.ktx)
    coreLibraryDesugaring(libs.desugar.jdk.libs)

    implementation(platform(libs.compose.bom))
    implementation(libs.compose.ui)
    implementation(libs.compose.ui.tooling.preview)
    implementation(libs.compose.material3)
    implementation(libs.compose.material.icons)
    debugImplementation(libs.compose.ui.tooling)

    // Low-level camera frames; QR decoding is our own (ZXing core on the Y plane).
    implementation(libs.camera.camera2)
    implementation(libs.camera.lifecycle)
    implementation(libs.camera.view)
    implementation(libs.zxing.core)

    // Attempt log on the phone (PLAN §5.2)
    implementation(libs.room.runtime)
    implementation(libs.room.ktx)
    ksp(libs.room.compiler)

    implementation(libs.biometric)
    implementation(libs.okhttp)
    implementation(libs.kotlinx.serialization.json)
    implementation(libs.kotlinx.coroutines.android)

    testImplementation(libs.junit)
}
