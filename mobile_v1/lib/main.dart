import 'package:flutter/material.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:google_fonts/google_fonts.dart';
import 'firebase_options.dart';
import 'providers/auth_provider.dart';
import 'screens/login_screen.dart';
import 'screens/dashboard_screen.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  runApp(
    const ProviderScope(
      child: MyApp(),
    ),
  );
}

class MyApp extends StatelessWidget {
  const MyApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'خبراء الرسم',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        colorScheme: ColorScheme.fromSeed(
          seedColor: const Color(0xFF2C7A7D),
          primary: const Color(0xFF2C7A7D),
          surface: Colors.white,
          brightness: Brightness.light,
        ),
        useMaterial3: true,
        textTheme: GoogleFonts.cairoTextTheme(),
      ),
      home: const FirebaseInitializer(),
      localizationsDelegates: const [
        GlobalMaterialLocalizations.delegate,
        GlobalWidgetsLocalizations.delegate,
        GlobalCupertinoLocalizations.delegate,
      ],
      supportedLocales: const [
        Locale('ar', 'SA'),
        Locale('en', 'US'),
      ],
      locale: const Locale('ar', 'SA'),
    );
  }
}

class FirebaseInitializer extends StatefulWidget {
  const FirebaseInitializer({super.key});

  @override
  State<FirebaseInitializer> createState() => _FirebaseInitializerState();
}

class _FirebaseInitializerState extends State<FirebaseInitializer> {
  late Future<void> _initialization;

  @override
  void initState() {
    super.initState();
    _initialization = _initFirebase();
  }

  Future<void> _initFirebase() async {
    try {
      // Check if Firebase is already initialized by trying to access the default app
      Firebase.app();
    } catch (e) {
      // If Firebase.app() throws, it means it's NOT initialized, so we do it now
      try {
        await Firebase.initializeApp(
          options: DefaultFirebaseOptions.currentPlatform,
        );
      } catch (e2) {
        debugPrint("Firebase init inner error: $e2");
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return FutureBuilder(
      future: _initialization,
      builder: (context, snapshot) {
        if (snapshot.connectionState == ConnectionState.done) {
          return const AuthWrapper();
        }
        return const AppSplashScreen(message: 'جاري تهيئة النظام...');
      },
    );
  }
}

class AuthWrapper extends ConsumerWidget {
  const AuthWrapper({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final authStateAsync = ref.watch(authStateProvider);

    return authStateAsync.when(
      data: (user) {
        if (user == null) return const LoginScreen();
        return const DashboardScreen();
      },
      loading: () => const AppSplashScreen(message: 'جاري التحقق من الهوية...'),
      error: (err, stack) => Scaffold(
        body: Center(child: Text('حدث خطأ: $err')),
      ),
    );
  }
}

class AppSplashScreen extends StatelessWidget {
  final String message;
  const AppSplashScreen({super.key, required this.message});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF1A4D4E),
      body: Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            // No container, just the logo with a subtle shadow
            SizedBox(
              width: 180,
              height: 180,
              child: Image.network(
                'https://i.imgur.com/yYZDeHZ.jpg',
                fit: BoxFit.contain,
                errorBuilder: (ctx, _, __) => const Icon(Icons.business, color: Colors.white, size: 80),
              ),
            ),
            const SizedBox(height: 20),
            Text(
              'خبراء الرسم',
              style: GoogleFonts.cairo(
                color: Colors.white,
                fontSize: 32,
                fontWeight: FontWeight.bold,
                letterSpacing: 1.2,
              ),
            ),
            const SizedBox(height: 10),
            Text(
              'EXPERT SYSTEM',
              style: GoogleFonts.outfit(
                color: Colors.white54,
                fontSize: 14,
                fontWeight: FontWeight.w500,
                letterSpacing: 5,
              ),
            ),
            const SizedBox(height: 60),
            const CircularProgressIndicator(
              color: Colors.white,
              strokeWidth: 2,
            ),
            const SizedBox(height: 20),
            Text(
              message,
              style: GoogleFonts.cairo(color: Colors.white38, fontSize: 13),
            ),
          ],
        ),
      ),
    );
  }
}

