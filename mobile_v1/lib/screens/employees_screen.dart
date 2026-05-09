import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../providers/hr_provider.dart';
import '../models/models.dart';
import 'add_employee_screen.dart';

class EmployeesScreen extends ConsumerWidget {
  const EmployeesScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final employeesAsync = ref.watch(employeesProvider);

    return Scaffold(
      appBar: AppBar(
        title: const Text('الموظفين والعمال'),
        centerTitle: true,
      ),
      body: employeesAsync.when(
        data: (employees) {
          if (employees.isEmpty) {
            return const Center(child: Text('لا يوجد موظفين مسجلين.'));
          }

          return ListView.builder(
            padding: const EdgeInsets.all(16),
            itemCount: employees.length,
            itemBuilder: (context, index) {
              final employee = employees[index];
              return _buildEmployeeCard(context, employee);
            },
          );
        },
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (err, stack) => Center(child: Text('خطأ: $err')),
      ),
      floatingActionButton: FloatingActionButton(
        onPressed: () {
          Navigator.push(
            context,
            MaterialPageRoute(builder: (_) => const AddEmployeeScreen()),
          );
        },
        child: const Icon(Icons.person_add),
      ),
    );
  }

  Widget _buildEmployeeCard(BuildContext context, UserProfile employee) {
    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      child: ListTile(
        contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
        leading: CircleAvatar(
          backgroundColor: Theme.of(context).colorScheme.primary.withOpacity(0.1),
          radius: 28,
          backgroundImage: employee.photoURL != null && employee.photoURL!.isNotEmpty 
            ? NetworkImage(employee.photoURL!) 
            : null,
          child: employee.photoURL == null || employee.photoURL!.isEmpty
            ? Text(
                employee.name.isNotEmpty ? employee.name.substring(0, 1).toUpperCase() : '؟',
                style: TextStyle(
                  fontSize: 24, 
                  fontWeight: FontWeight.bold,
                  color: Theme.of(context).colorScheme.primary,
                ),
              )
            : null,
        ),
        title: Text(
          employee.name,
          style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16),
        ),
        subtitle: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const SizedBox(height: 4),
            Text(_getRoleName(employee.role)),
            if (employee.phone != null && employee.phone!.isNotEmpty)
              Text(employee.phone!, style: const TextStyle(fontSize: 12)),
          ],
        ),
        trailing: IconButton(
          icon: const Icon(Icons.chevron_right),
          onPressed: () {
            // View employee details
          },
        ),
      ),
    );
  }

  String _getRoleName(UserRole role) {
    switch (role) {
      case UserRole.manager: return 'مدير';
      case UserRole.supervisor: return 'مشرف';
      case UserRole.employee: return 'موظف';
      case UserRole.worker: return 'عامل';
      default: return 'غير محدد';
    }
  }
}
