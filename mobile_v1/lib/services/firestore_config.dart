import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_core/firebase_core.dart';

class FirestoreConfig {
  static const String databaseId = 'ai-studio-1758a4bd-062b-4cbd-86a8-20716454656a';
  static FirebaseFirestore? _db;
  
  static FirebaseFirestore get db {
    if (_db != null) return _db!;
    
    try {
      _db = FirebaseFirestore.instanceFor(
        app: Firebase.app(),
        databaseId: databaseId,
      );
      return _db!;
    } catch (e) {
      // If Firebase.app() throws, it means Firebase is not ready.
      // We should return the default instance or handle it in the caller.
      return FirebaseFirestore.instance;
    }
  }
}
