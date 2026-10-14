plugins {
    id("com.android.application")
    id("rust")
}

android {
    namespace="com.tcs.zenithdb"
    compileSdk = 34
    defaultConfig {
        applicationId = "com.tcs.zenithdb"
        minSdk = 24
        targetSdk = 34
        versionCode = 1
        versionName = "1.0"
    }
    buildTypes {
        getByName("debug") {
            isDebuggable = true
            isJniDebuggable = true
            isMinifyEnabled = false
        }
        getByName("release") {
            isMinifyEnabled = true
        }
    }
}

rust {
    rootDirRel = "../../.."
}

dependencies {
    implementation("androidx.appcompat:appcompat:1.6.1")
    implementation("androidx.core:core:1.12.0")
    implementation("androidx.webkit:webkit:1.8.0")
    implementation("androidx.lifecycle:lifecycle-process:2.6.2")
    implementation("androidx.lifecycle:lifecycle-runtime:2.6.2")
}
