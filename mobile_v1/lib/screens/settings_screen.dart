import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_fonts/google_fonts.dart';
import '../providers/auth_provider.dart';

class SettingsScreen extends ConsumerWidget {
  const SettingsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return Scaffold(
      appBar: AppBar(
        title: Text('إعدادات النظام', style: GoogleFonts.cairo(fontWeight: FontWeight.bold)),
        centerTitle: true,
      ),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          _buildSectionHeader('الحساب'),
          _buildSettingsTile(
            context,
            Icons.person_outline,
            'تعديل الملف الشخصي',
            'الاسم، الصورة، بيانات الاتصال',
            () {},
          ),
          _buildSettingsTile(
            context,
            Icons.lock_outline,
            'الأمان وكلمة المرور',
            'تغيير كلمة المرور، التحقق الثنائي',
            () {},
          ),
          const SizedBox(height: 24),
          _buildSectionHeader('النظام'),
          _buildSettingsTile(
            context,
            Icons.notifications_none_outlined,
            'التنبيهات',
            'تخصيص تنبيهات المشاريع والمالية',
            () {},
          ),
          _buildSettingsTile(
            context,
            Icons.language_outlined,
            'اللغة',
            'العربية (افتراضي)',
            () {},
          ),
          _buildSettingsTile(
            context,
            Icons.palette_outlined,
            'المظهر',
            'الوضع الداكن / الفاتح',
            () {},
          ),
          const SizedBox(height: 24),
          _buildSectionHeader('عن التطبيق'),
          _buildSettingsTile(
            context,
            Icons.info_outline,
            'حول خبراء الرسم',
            'الإصدار 1.0.0',
            () {},
          ),
          _buildSettingsTile(
            context,
            Icons.help_outline,
            'الدعم الفني',
            'تواصل مع فريق التطوير',
            () {},
          ),
          const SizedBox(height: 40),
          ElevatedButton.icon(
            onPressed: () => ref.read(authServiceProvider).signOut(),
            icon: const Icon(Icons.logout, color: Colors.red),
            label: Text('تسجيل الخروج', style: GoogleFonts.cairo(color: Colors.red, fontWeight: FontWeight.bold)),
            style: ElevatedButton.styleFrom(
              backgroundColor: Colors.red.withOpacity(0.1),
              elevation: 0,
              padding: const EdgeInsets.symmetric(vertical: 16),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(15)),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildSectionHeader(String title) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      child: Text(
        title,
        style: GoogleFonts.cairo(
          fontSize: 14,
          fontWeight: FontWeight.bold,
          color: const Color(0xFF2C7A7D),
        ),
      ),
    );
  }

  Widget _buildSettingsTile(BuildContext context, IconData icon, String title, String subtitle, VoidCallback onTap) {
    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(15)),
      elevation: 0,
      color: Colors.grey.shade50,
      child: ListTile(
        leading: Container(
          padding: const EdgeInsets.all(8),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(10),
          ),
          child: Icon(icon, color: const Color(0xFF2C7A7D)),
        ),
        title: Text(title, style: GoogleFonts.cairo(fontWeight: FontWeight.bold, fontSize: 16)),
        subtitle: Text(subtitle, style: GoogleFonts.cairo(fontSize: 12, color: Colors.grey)),
        trailing: const Icon(Icons.chevron_left, size: 20),
        onTap: onTap,
      ),
    );
  }
}
