import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../services/project_service.dart';
import '../models/models.dart';

final projectServiceProvider = Provider<ProjectService>((ref) {
  return ProjectService();
});

final projectsProvider = StreamProvider<List<Project>>((ref) {
  final service = ref.watch(projectServiceProvider);
  return service.getProjects();
});

final projectDetailProvider = StreamProvider.family<Project, String>((ref, id) {
  final service = ref.watch(projectServiceProvider);
  return service.getProject(id);
});
