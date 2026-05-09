import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../services/inventory_service.dart';

final inventoryServiceProvider = Provider<InventoryService>((ref) {
  return InventoryService();
});

final inventoryProvider = StreamProvider<List<InventoryItem>>((ref) {
  final service = ref.watch(inventoryServiceProvider);
  return service.getInventory();
});
