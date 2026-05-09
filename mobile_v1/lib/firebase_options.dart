import 'package:firebase_core/firebase_core.dart' show FirebaseOptions;
import 'package:flutter/foundation.dart'
    show defaultTargetPlatform, kIsWeb, TargetPlatform;

/// Default [FirebaseOptions] for use with your Firebase apps.
///
/// Example:
/// ```dart
/// import 'firebase_options.dart';
/// // ...
/// await Firebase.initializeApp(
///   options: DefaultFirebaseOptions.currentPlatform,
/// );
/// ```
class DefaultFirebaseOptions {
  static FirebaseOptions get currentPlatform {
    if (kIsWeb) {
      return web;
    }
    switch (defaultTargetPlatform) {
      case TargetPlatform.android:
        return android;
      case TargetPlatform.iOS:
        return ios;
      case TargetPlatform.macOS:
        throw UnsupportedError(
          'DefaultFirebaseOptions have not been configured for macos - '
          'you can reconfigure this by running the FlutterFire CLI again.',
        );
      case TargetPlatform.windows:
        throw UnsupportedError(
          'DefaultFirebaseOptions have not been configured for windows - '
          'you can reconfigure this by running the FlutterFire CLI again.',
        );
      case TargetPlatform.linux:
        throw UnsupportedError(
          'DefaultFirebaseOptions have not been configured for linux - '
          'you can reconfigure this by running the FlutterFire CLI again.',
        );
      default:
        throw UnsupportedError(
          'DefaultFirebaseOptions are not supported for this platform.',
        );
    }
  }

  static const FirebaseOptions web = FirebaseOptions(
    apiKey: 'AIzaSyAIk0A-PC3z5m4809YX8FG7idAOzZlW_D4',
    appId: '1:234055211388:web:c0b90cc2b89a012052ecf9',
    messagingSenderId: '234055211388',
    projectId: 'gen-lang-client-0313577394',
    authDomain: 'gen-lang-client-0313577394.firebaseapp.com',
    storageBucket: 'gen-lang-client-0313577394.firebasestorage.app',
  );

  static const FirebaseOptions android = FirebaseOptions(
    apiKey: 'AIzaSyAIk0A-PC3z5m4809YX8FG7idAOzZlW_D4',
    appId: '1:234055211388:android:2c42cd066296d8cf52ecf9', // Updated to match user Firebase Console
    messagingSenderId: '234055211388',
    projectId: 'gen-lang-client-0313577394',
    storageBucket: 'gen-lang-client-0313577394.firebasestorage.app',
  );

  static const FirebaseOptions ios = FirebaseOptions(
    apiKey: 'AIzaSyAIk0A-PC3z5m4809YX8FG7idAOzZlW_D4',
    appId: '1:234055211388:ios:e1c90cc2b89a012052ecf9', // Note: Needs exact iOS AppId for production
    messagingSenderId: '234055211388',
    projectId: 'gen-lang-client-0313577394',
    storageBucket: 'gen-lang-client-0313577394.firebasestorage.app',
    iosBundleId: 'com.example.mobileV1',
  );
}
