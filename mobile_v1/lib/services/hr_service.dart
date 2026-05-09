import 'package:cloud_firestore/cloud_firestore.dart' hide Transaction;
import '../models/models.dart';
import 'firestore_config.dart';

class HrService {
  final FirebaseFirestore _firestore = FirestoreConfig.db;

  // Fetch all official employees (from users collection)
  Stream<List<UserProfile>> getEmployees() {
    return _firestore
        .collection('users')
        .snapshots()
        .map((snapshot) {
      return snapshot.docs.map((doc) {
        final data = doc.data();
        data['id'] = doc.id;
        return UserProfile.fromMap(data);
      }).toList();
    });
  }

  // Fetch all daily laborers (from workers collection)
  Stream<List<Map<String, dynamic>>> getWorkers() {
    return _firestore
        .collection('workers')
        .snapshots()
        .map((snapshot) {
      return snapshot.docs.map((doc) {
        final data = doc.data();
        data['id'] = doc.id;
        return data;
      }).toList();
    });
  }

  // Fetch attendance records for today or a specific date
  Stream<List<Attendance>> getAttendance(String date) {
    return _firestore
        .collection('attendance')
        .where('date', isEqualTo: date)
        .snapshots()
        .map((snapshot) {
      return snapshot.docs.map((doc) {
        final data = doc.data();
        data['id'] = doc.id;
        return Attendance.fromMap(data);
      }).toList();
    });
  }

  // Check in / Check out functionality
  Future<void> logAttendance({
    required String userId,
    required String userName,
    required String type, // 'checkIn' or 'checkOut'
    required String date,
    required String time,
  }) async {
    // Generate a consistent ID for the day's record for this user
    final recordId = '${userId}_$date';
    final docRef = _firestore.collection('attendance').doc(recordId);

    final docSnap = await docRef.get();

    if (docSnap.exists) {
      // Update existing record
      await docRef.update({
        if (type == 'checkIn') 'checkIn': time,
        if (type == 'checkOut') 'checkOut': time,
        'status': type == 'checkIn' ? 'present' : docSnap.data()?['status'] ?? 'present',
      });
    } else {
      // Create new record
      await docRef.set({
        'userId': userId,
        'userName': userName,
        'date': date,
        'checkIn': type == 'checkIn' ? time : null,
        'checkOut': type == 'checkOut' ? time : null,
        'status': type == 'checkIn' ? 'present' : 'absent',
      });
    }
  }

  // Add new official employee
  Future<void> addEmployee(UserProfile employee) async {
    final data = employee.toMap();
    data.remove('id');
    await _firestore.collection('users').add(data);
  }

  // Add new daily laborer
  Future<void> addWorker(Map<String, dynamic> workerData) async {
    workerData['createdAt'] = FieldValue.serverTimestamp();
    await _firestore.collection('workers').add(workerData);
  }
}
