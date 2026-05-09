import 'package:cloud_firestore/cloud_firestore.dart' hide Transaction;
import '../models/models.dart';
import 'firestore_config.dart';

class FinancialService {
  final FirebaseFirestore _firestore = FirestoreConfig.db;

  Stream<List<Transaction>> getTransactions() {
    return _firestore
        .collection('transactions')
        .orderBy('date', descending: true)
        .snapshots()
        .map((snapshot) {
      return snapshot.docs.map((doc) {
        final data = doc.data();
        data['id'] = doc.id;
        return Transaction.fromMap(data);
      }).toList();
    });
  }

  Future<void> addTransaction(Transaction transaction) async {
    // Convert transaction to map without ID, let Firestore generate one
    final data = {
      'type': transaction.type,
      'category': transaction.category,
      'amount': transaction.amount,
      'description': transaction.description,
      'date': transaction.date ?? FieldValue.serverTimestamp(),
      'createdBy': transaction.createdBy,
    };
    await _firestore.collection('transactions').add(data);
  }
}
