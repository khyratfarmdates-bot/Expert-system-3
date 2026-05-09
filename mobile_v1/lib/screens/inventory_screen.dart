import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../providers/inventory_provider.dart';
import '../services/inventory_service.dart';
import 'add_inventory_screen.dart';

class InventoryScreen extends ConsumerWidget {
  const InventoryScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final inventoryAsync = ref.watch(inventoryProvider);

    return Scaffold(
      appBar: AppBar(
        title: const Text('إدارة الأصول والمخزون'),
        centerTitle: true,
      ),
      body: inventoryAsync.when(
        data: (items) {
          if (items.isEmpty) {
            return const Center(child: Text('لا توجد عناصر في المخزون حالياً.'));
          }
          return ListView.builder(
            padding: const EdgeInsets.all(16),
            itemCount: items.length,
            itemBuilder: (context, index) {
              final item = items[index];
              return _buildInventoryCard(context, item);
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
            MaterialPageRoute(builder: (_) => const AddInventoryScreen()),
          );
        },
        child: const Icon(Icons.add),
      ),
    );
  }

  Widget _buildInventoryCard(BuildContext context, InventoryItem item) {
    Color statusColor;
    String statusText;

    switch (item.status) {
      case 'available':
        statusColor = Colors.green;
        statusText = 'متاح';
        break;
      case 'in-use':
        statusColor = Colors.blue;
        statusText = 'قيد الاستخدام';
        break;
      case 'maintenance':
        statusColor = Colors.orange;
        statusText = 'في الصيانة';
        break;
      default:
        statusColor = Colors.grey;
        statusText = 'غير معروف';
    }

    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      child: Padding(
        padding: const EdgeInsets.all(16.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Expanded(
                  child: Text(
                    item.name,
                    style: const TextStyle(
                      fontSize: 18,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                ),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                  decoration: BoxDecoration(
                    color: statusColor.withOpacity(0.1),
                    borderRadius: BorderRadius.circular(20),
                    border: Border.all(color: statusColor),
                  ),
                  child: Text(
                    statusText,
                    style: TextStyle(
                      color: statusColor,
                      fontWeight: FontWeight.bold,
                      fontSize: 12,
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 8),
            Row(
              children: [
                const Icon(Icons.category, size: 16, color: Colors.grey),
                const SizedBox(width: 4),
                Text(item.category, style: const TextStyle(color: Colors.grey)),
                const SizedBox(width: 16),
                const Icon(Icons.format_list_numbered, size: 16, color: Colors.grey),
                const SizedBox(width: 4),
                Text('الكمية: ${item.quantity}', style: const TextStyle(color: Colors.grey)),
              ],
            ),
            if (item.assignedTo != null && item.assignedTo!.isNotEmpty) ...[
              const SizedBox(height: 8),
              Row(
                children: [
                  const Icon(Icons.person, size: 16, color: Colors.blueGrey),
                  const SizedBox(width: 4),
                  Text('مسند إلى: ${item.assignedTo}', style: const TextStyle(color: Colors.blueGrey)),
                ],
              ),
            ],
            if (item.location != null && item.location!.isNotEmpty) ...[
              const SizedBox(height: 4),
              Row(
                children: [
                  const Icon(Icons.location_on, size: 16, color: Colors.blueGrey),
                  const SizedBox(width: 4),
                  Text('الموقع: ${item.location}', style: const TextStyle(color: Colors.blueGrey)),
                ],
              ),
            ],
          ],
        ),
      ),
    );
  }
}
