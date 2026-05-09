import 'package:cloud_firestore/cloud_firestore.dart' hide Transaction;
import 'firestore_config.dart';

class InventoryItem {
  final String id;
  final String name;
  final String category;
  final int quantity;
  final String status; // 'available', 'in-use', 'maintenance'
  final String? assignedTo;
  final String? location;

  InventoryItem({
    required this.id,
    required this.name,
    required this.category,
    required this.quantity,
    required this.status,
    this.assignedTo,
    this.location,
  });

  factory InventoryItem.fromMap(Map<String, dynamic> data) {
    return InventoryItem(
      id: data['id'] ?? '',
      name: data['name'] ?? '',
      category: data['category'] ?? 'عام',
      quantity: data['quantity']?.toInt() ?? 0,
      status: data['status'] ?? 'available',
      assignedTo: data['assignedTo'],
      location: data['location'],
    );
  }

  Map<String, dynamic> toMap() {
    return {
      'name': name,
      'category': category,
      'quantity': quantity,
      'status': status,
      'assignedTo': assignedTo,
      'location': location,
    };
  }
}

class InventoryService {
  final FirebaseFirestore _firestore = FirestoreConfig.db;

  Stream<List<InventoryItem>> getInventory() {
    return _firestore
        .collection('inventory')
        .snapshots()
        .map((snapshot) {
      return snapshot.docs.map((doc) {
        final data = doc.data();
        data['id'] = doc.id;
        return InventoryItem.fromMap(data);
      }).toList();
    });
  }

  Future<void> addInventoryItem(InventoryItem item) async {
    final data = item.toMap();
    data['createdAt'] = FieldValue.serverTimestamp();
    await _firestore.collection('inventory').add(data);
  }
}
