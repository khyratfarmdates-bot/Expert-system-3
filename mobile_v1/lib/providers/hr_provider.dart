import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../services/hr_service.dart';
import '../models/models.dart';
import 'package:intl/intl.dart';

final hrServiceProvider = Provider<HrService>((ref) {
  return HrService();
});

final employeesProvider = StreamProvider<List<UserProfile>>((ref) {
  final service = ref.watch(hrServiceProvider);
  return service.getEmployees();
});

// A provider that takes a date string and returns attendance for that date
final attendanceProvider = StreamProvider.family<List<Attendance>, String>((ref, date) {
  final service = ref.watch(hrServiceProvider);
  return service.getAttendance(date);
});

// Provider for today's attendance
final todayAttendanceProvider = StreamProvider<List<Attendance>>((ref) {
  final service = ref.watch(hrServiceProvider);
  final today = DateFormat('yyyy-MM-dd').format(DateTime.now());
  return service.getAttendance(today);
});

final workersProvider = StreamProvider<List<Map<String, dynamic>>>((ref) {
  final service = ref.watch(hrServiceProvider);
  return service.getWorkers();
});
