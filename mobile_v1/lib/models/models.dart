import 'package:cloud_firestore/cloud_firestore.dart' hide Transaction;

enum UserRole { manager, supervisor, employee, worker }

class UserProfile {
  final String id;
  final String uid;
  final String email;
  final String name;
  final UserRole role;
  final String? dept;
  final String? photoURL;
  final double? salary;
  final String? iqamaNumber;
  final String? iqamaExpiry;
  final String? phone;
  final String? nationality;
  final String? joinedAt;

  UserProfile({
    required this.id,
    required this.uid,
    required this.email,
    required this.name,
    required this.role,
    this.dept,
    this.photoURL,
    this.salary,
    this.iqamaNumber,
    this.iqamaExpiry,
    this.phone,
    this.nationality,
    this.joinedAt,
  });

  factory UserProfile.fromMap(Map<String, dynamic> data) {
    return UserProfile(
      id: data['id'] ?? '',
      uid: data['uid'] ?? '',
      email: data['email'] ?? '',
      name: data['name'] ?? '',
      role: UserRole.values.firstWhere(
        (e) => e.toString().split('.').last == data['role'],
        orElse: () => UserRole.worker,
      ),
      dept: data['dept'],
      photoURL: data['photoURL'],
      salary: data['salary']?.toDouble(),
      iqamaNumber: data['iqamaNumber'],
      iqamaExpiry: data['iqamaExpiry'],
      phone: data['phone'],
      nationality: data['nationality'],
      joinedAt: data['joinedAt'],
    );
  }

  Map<String, dynamic> toMap() {
    return {
      'id': id,
      'uid': uid,
      'email': email,
      'name': name,
      'role': role.toString().split('.').last,
      'dept': dept,
      'photoURL': photoURL,
      'salary': salary,
      'iqamaNumber': iqamaNumber,
      'iqamaExpiry': iqamaExpiry,
      'phone': phone,
      'nationality': nationality,
      'joinedAt': joinedAt,
    };
  }
}

class Project {
  final String id;
  final String title;
  final String status;
  final double? progress;
  final String? clientName;
  final String? locationLink;
  final String? startDate;
  final String? endDate;

  Project({
    required this.id,
    required this.title,
    required this.status,
    this.progress,
    this.clientName,
    this.locationLink,
    this.startDate,
    this.endDate,
  });

  factory Project.fromMap(Map<String, dynamic> data) {
    return Project(
      id: data['id'] ?? '',
      title: data['title'] ?? data['name'] ?? 'Untitled Project',
      status: data['status'] ?? 'active',
      progress: data['progress']?.toDouble(),
      clientName: data['clientName'],
      locationLink: data['locationLink'],
      startDate: data['startDate'],
      endDate: data['endDate'],
    );
  }

  Map<String, dynamic> toMap() {
    return {
      'id': id,
      'title': title,
      'status': status,
      'progress': progress,
      'clientName': clientName,
      'locationLink': locationLink,
      'startDate': startDate,
      'endDate': endDate,
    };
  }
}

class Transaction {
  final String id;
  final String type; // 'income' | 'expense'
  final String category;
  final double amount;
  final String description;
  final dynamic date;
  final String createdBy;

  Transaction({
    required this.id,
    required this.type,
    required this.category,
    required this.amount,
    required this.description,
    required this.date,
    required this.createdBy,
  });

  factory Transaction.fromMap(Map<String, dynamic> data) {
    return Transaction(
      id: data['id'] ?? '',
      type: data['type'] ?? 'expense',
      category: data['category'] ?? '',
      amount: data['amount']?.toDouble() ?? 0.0,
      description: data['description'] ?? '',
      date: data['date'],
      createdBy: data['createdBy'] ?? '',
    );
  }
}

class Attendance {
  final String id;
  final String userId;
  final String userName;
  final String date;
  final String? checkIn;
  final String? checkOut;
  final String status;

  Attendance({
    required this.id,
    required this.userId,
    required this.userName,
    required this.date,
    this.checkIn,
    this.checkOut,
    required this.status,
  });

  factory Attendance.fromMap(Map<String, dynamic> data) {
    return Attendance(
      id: data['id'] ?? '',
      userId: data['userId'] ?? '',
      userName: data['userName'] ?? '',
      date: data['date'] ?? '',
      checkIn: data['checkIn'],
      checkOut: data['checkOut'],
      status: data['status'] ?? 'absent',
    );
  }
}
