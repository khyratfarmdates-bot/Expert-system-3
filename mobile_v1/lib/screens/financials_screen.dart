import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../providers/financial_provider.dart';
import '../models/models.dart';
import 'package:intl/intl.dart';
import 'add_transaction_screen.dart';

class FinancialsScreen extends ConsumerWidget {
  const FinancialsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final transactionsAsync = ref.watch(transactionsProvider);

    return Scaffold(
      appBar: AppBar(
        title: const Text('الإدارة المالية'),
        centerTitle: true,
      ),
      body: transactionsAsync.when(
        data: (transactions) {
          if (transactions.isEmpty) {
            return const Center(child: Text('لا توجد عمليات مالية حالياً.'));
          }

          // Calculate totals
          double totalIncome = 0;
          double totalExpense = 0;
          for (var t in transactions) {
            if (t.type == 'income') {
              totalIncome += t.amount;
            } else {
              totalExpense += t.amount;
            }
          }
          final balance = totalIncome - totalExpense;

          return Column(
            children: [
              _buildSummaryCards(context, totalIncome, totalExpense, balance),
              const Padding(
                padding: EdgeInsets.symmetric(horizontal: 16.0, vertical: 8.0),
                child: Align(
                  alignment: Alignment.centerRight,
                  child: Text(
                    'سجل العمليات',
                    style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
                  ),
                ),
              ),
              Expanded(
                child: ListView.builder(
                  itemCount: transactions.length,
                  itemBuilder: (context, index) {
                    final transaction = transactions[index];
                    return _buildTransactionItem(context, transaction);
                  },
                ),
              ),
            ],
          );
        },
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (err, stack) => Center(child: Text('خطأ: $err')),
      ),
      floatingActionButton: FloatingActionButton(
        onPressed: () {
          Navigator.push(
            context,
            MaterialPageRoute(builder: (_) => const AddTransactionScreen()),
          );
        },
        child: const Icon(Icons.add),
      ),
    );
  }

  Widget _buildSummaryCards(BuildContext context, double income, double expense, double balance) {
    final formatCurrency = NumberFormat.currency(symbol: 'SAR ', decimalDigits: 2);
    
    return Container(
      padding: const EdgeInsets.all(16.0),
      color: Theme.of(context).primaryColor.withOpacity(0.05),
      child: Column(
        children: [
          Row(
            children: [
              Expanded(
                child: _buildSummaryCard(
                  'الرصيد الحالي',
                  formatCurrency.format(balance),
                  balance >= 0 ? Colors.blue : Colors.red,
                  Icons.account_balance_wallet,
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              Expanded(
                child: _buildSummaryCard(
                  'المدخولات',
                  formatCurrency.format(income),
                  Colors.green,
                  Icons.arrow_circle_up,
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: _buildSummaryCard(
                  'المصروفات',
                  formatCurrency.format(expense),
                  Colors.red,
                  Icons.arrow_circle_down,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildSummaryCard(String title, String amount, Color color, IconData icon) {
    return Card(
      elevation: 2,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      child: Padding(
        padding: const EdgeInsets.all(16.0),
        child: Column(
          children: [
            Icon(icon, color: color, size: 32),
            const SizedBox(height: 8),
            Text(title, style: const TextStyle(color: Colors.grey)),
            const SizedBox(height: 4),
            Text(
              amount,
              style: TextStyle(
                fontSize: 18,
                fontWeight: FontWeight.bold,
                color: color,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildTransactionItem(BuildContext context, Transaction transaction) {
    final isIncome = transaction.type == 'income';
    final color = isIncome ? Colors.green : Colors.red;
    final icon = isIncome ? Icons.arrow_downward : Icons.arrow_upward;
    final formatCurrency = NumberFormat.currency(symbol: 'SAR ', decimalDigits: 2);

    // Format date properly (assuming Firebase Timestamp or string)
    String dateStr = '';
    if (transaction.date != null) {
      if (transaction.date is String) {
        dateStr = transaction.date.toString().substring(0, 10);
      } else {
        // Handle Timestamp later if needed
        dateStr = '...';
      }
    }

    return Card(
      margin: const EdgeInsets.symmetric(horizontal: 16.0, vertical: 6.0),
      child: ListTile(
        leading: CircleAvatar(
          backgroundColor: color.withOpacity(0.1),
          child: Icon(icon, color: color),
        ),
        title: Text(
          transaction.description.isNotEmpty ? transaction.description : transaction.category,
          style: const TextStyle(fontWeight: FontWeight.bold),
        ),
        subtitle: Text(dateStr),
        trailing: Text(
          '${isIncome ? '+' : '-'}${formatCurrency.format(transaction.amount)}',
          style: TextStyle(
            color: color,
            fontWeight: FontWeight.bold,
            fontSize: 16,
          ),
        ),
      ),
    );
  }
}
