import 'package:cloud_firestore/cloud_firestore.dart' hide Transaction;
import '../models/models.dart';
import 'firestore_config.dart';

class ProjectService {
  final FirebaseFirestore _firestore = FirestoreConfig.db;

  Stream<List<Project>> getProjects() {
    return _firestore
        .collection('projects')
        .orderBy('createdAt', descending: true)
        .snapshots()
        .map((snapshot) {
      return snapshot.docs.map((doc) {
        final data = doc.data();
        data['id'] = doc.id;
        return Project.fromMap(data);
      }).toList();
    });
  }

  Stream<Project> getProject(String id) {
    return _firestore.collection('projects').doc(id).snapshots().map((doc) {
      final data = doc.data()!;
      data['id'] = doc.id;
      return Project.fromMap(data);
    });
  }

  Future<void> addProject(Project project) async {
    final data = project.toMap();
    data.remove('id');
    data['createdAt'] = FieldValue.serverTimestamp();
    await _firestore.collection('projects').add(data);
  }
}
