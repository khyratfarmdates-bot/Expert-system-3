import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../services/financial_service.dart';
import '../models/models.dart';

final financialServiceProvider = Provider<FinancialService>((ref) {
  return FinancialService();
});

final transactionsProvider = StreamProvider<List<Transaction>>((ref) {
  final service = ref.watch(financialServiceProvider);
  return service.getTransactions();
});
