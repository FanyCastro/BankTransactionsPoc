# Detailed Explanation of assetlinks.json

## What is assetlinks.json?

This file creates a verified digital relationship between:

- Your website domain (where the file is hosted)
- Your Android app (via package name and signing certificate)

## Key Purposes:

- **Automatic app verification** - Android checks this to confirm your app is authorized to handle links from your domain
- **Seamless UX** - Eliminates the "Open with..." dialog when clicking links
- **Security** - Prevents other apps from hijacking your deep links

## File Structure Explained:

```json 
[{
  "relation": ["delegate_permission/common.handle_all_urls"],
  "target": {
    "namespace": "android_app",
    "package_name": "com.banktransactionspoc",
    "sha256_cert_fingerprints": [
      "SHA256_OF_YOUR_SIGNING_CERTIFICATE"
    ]
  }
}]
````

- `relation`: defines what permissions are granted
    - `"delegate_permission/common.handle_all_urls"` means: this app can handle ALL web links from your domain
- `target.namespace`: always `"android_app"` for Android apps
- `target.package_name`: must exactly match your app's `applicationId` in `build.gradle``
- `sha256_cert_fingerprints`: the fingerprint of your APK signing certificate, critical security measure to ensure only your app can handle these links
    - `keytool -list -v -keystore ~/.android/debug.keystore -alias androiddebugkey -storepass android -keypass android (debug fingerprint)`


## Real-world example

Imagine your banking app has:

- Domain: `https://bankpoc.com`
- Package: `com.banktransactionspoc`

When someone clicks on `https://bankpoc.com/transaction/123`:

1. Android will check `https://bankpoc.com/.well-known/assetlinks.json`
2. It will verify that the installed app:
    - Has the package com.banktransactionspoc
    - Is signed with the declared certificate
4. If everything matches, it will directly open your app on the transaction screen for 123.

---

# ANDROID

```bash 
cd android
./gradlew clean
./gradlew assembleDebug
cd ..
````

```bash 
adb shell am start -W -a android.intent.action.VIEW \
-d "https://test-android-deeplinks.s3.eu-west-2.amazonaws.com/accounts/123/transactions/123" \
com.banktransactionspoc
```