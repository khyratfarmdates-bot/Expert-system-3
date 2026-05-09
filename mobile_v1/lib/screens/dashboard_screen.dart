import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_fonts/google_fonts.dart';
import '../models/models.dart';
import '../providers/auth_provider.dart';
import 'projects_screen.dart';
import 'financials_screen.dart';
import 'employees_screen.dart';
import 'attendance_screen.dart';
import 'inventory_screen.dart';
import 'smart_butler_screen.dart';
import 'workers_screen.dart';
import 'settings_screen.dart';
import 'archive_screen.dart';
import 'gallery_screen.dart';

class DashboardScreen extends ConsumerStatefulWidget {
  const DashboardScreen({super.key});

  @override
  ConsumerState<DashboardScreen> createState() => _DashboardScreenState();
}

class _DashboardScreenState extends ConsumerState<DashboardScreen> {
  int _currentIndex = 0;
  String _activeTab = 'dashboard';

  void _onTabChanged(int index) {
    setState(() {
      _currentIndex = index;
      switch (index) {
        case 0: _activeTab = 'dashboard'; break;
        case 1: _activeTab = 'projects'; break;
        case 2: _activeTab = 'financials'; break;
        case 3: _activeTab = 'butler'; break;
        case 4: _activeTab = 'profile'; break;
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    final userProfileAsync = ref.watch(userProfileProvider);
    final authUser = ref.watch(authStateProvider).value;

    return Scaffold(
      extendBody: true,
      drawer: _buildDrawer(context, authUser),
      body: _buildBody(context, userProfileAsync, authUser),
      bottomNavigationBar: _buildFloatingBottomBar(),
    );
  }

  Widget _buildBody(BuildContext context, AsyncValue<UserProfile?> userProfileAsync, dynamic authUser) {
    if (_activeTab == 'projects') return const ProjectsScreen();
    if (_activeTab == 'financials') return const FinancialsScreen();
    if (_activeTab == 'butler') return const SmartButlerScreen();
    if (_activeTab == 'profile') return _buildProfilePlaceholder(context, authUser);

    return Container(
      decoration: const BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topRight,
          end: Alignment.bottomLeft,
          colors: [
            Color(0xFF1A4D4E), // Dark Teal
            Color(0xFF2C7A7D), // Teal
          ],
        ),
      ),
      child: CustomScrollView(
        slivers: [
          _buildSliverAppBar(context, ref, authUser),
          SliverToBoxAdapter(
            child: userProfileAsync.when(
              data: (profile) => _buildDashboardContent(context, profile, authUser),
              loading: () => const Padding(
                padding: EdgeInsets.all(50.0),
                child: Center(child: CircularProgressIndicator(color: Colors.white)),
              ),
              error: (err, stack) => _buildErrorState(err),
            ),
          ),
          const SliverToBoxAdapter(child: SizedBox(height: 100)), // Space for floating bar
        ],
      ),
    );
  }

  Widget _buildFloatingBottomBar() {
    return Container(
      margin: const EdgeInsets.fromLTRB(24, 0, 24, 24),
      padding: const EdgeInsets.symmetric(horizontal: 10),
      height: 70,
      decoration: BoxDecoration(
        color: Colors.white.withOpacity(0.98), // Very low transparency as requested
        borderRadius: BorderRadius.circular(35),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.15),
            blurRadius: 20,
            offset: const Offset(0, 10),
          ),
        ],
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceAround,
        children: [
          _buildBottomNavItem(0, Icons.dashboard_rounded, 'الرئيسية'),
          _buildBottomNavItem(1, Icons.business_center_rounded, 'المشاريع'),
          _buildBottomNavItem(2, Icons.account_balance_wallet_rounded, 'المالية'),
          _buildBottomNavItem(3, Icons.auto_awesome_rounded, 'المساعد'),
          _buildBottomNavItem(4, Icons.person_rounded, 'الملف'),
        ],
      ),
    );
  }

  Widget _buildBottomNavItem(int index, IconData icon, String label) {
    final isSelected = _currentIndex == index;
    final color = isSelected ? Theme.of(context).colorScheme.primary : Colors.grey.withOpacity(0.5);

    return InkWell(
      onTap: () => _onTabChanged(index),
      borderRadius: BorderRadius.circular(30),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
        child: Icon(icon, color: color, size: 28),
      ),
    );
  }

  Widget _buildDrawer(BuildContext context, dynamic authUser) {
    return Drawer(
      child: Column(
        children: [
          _buildDrawerHeader(context, authUser),
          Expanded(
            child: ListView(
              padding: EdgeInsets.zero,
              children: [
                _buildDrawerSection('عام', [
                  _drawerItem(Icons.dashboard_rounded, 'الرئيسية', () => _onTabChanged(0)),
                  _drawerItem(Icons.bolt_rounded, 'موجز AI', () {}),
                ]),
                _buildDrawerSection('المالية', [
                  _drawerItem(Icons.account_balance_wallet_rounded, 'المالية', () => _onTabChanged(2)),
                  _drawerItem(Icons.verified_user_rounded, 'الاعتمادات', () {}),
                  _drawerItem(Icons.trending_up_rounded, 'المبيعات', () {}),
                  _drawerItem(Icons.receipt_long_rounded, 'المصروفات', () {}),
                ]),
                _buildDrawerSection('الموارد البشرية', [
                  _drawerItem(Icons.people_alt_rounded, 'الموظفين', () => Navigator.push(context, MaterialPageRoute(builder: (context) => const EmployeesScreen()))),
                  _drawerItem(Icons.group_rounded, 'العمالة اليومية', () => Navigator.push(context, MaterialPageRoute(builder: (context) => const WorkersScreen()))),
                  _drawerItem(Icons.access_time_filled_rounded, 'الحضور', () => Navigator.push(context, MaterialPageRoute(builder: (context) => const AttendanceScreen()))),
                ]),
                _buildDrawerSection('المشاريع', [
                  _drawerItem(Icons.business_center_rounded, 'المشاريع', () => _onTabChanged(1)),
                  _drawerItem(Icons.handshake_rounded, 'المقاولين', () {}),
                ]),
                _buildDrawerSection('الإعدادات', [
                  _drawerItem(Icons.settings_rounded, 'إعدادات النظام', () {
                    Navigator.pop(context);
                    Navigator.push(context, MaterialPageRoute(builder: (context) => const SettingsScreen()));
                  }),
                  _drawerItem(Icons.archive_rounded, 'الأرشيف', () {
                    Navigator.pop(context);
                    Navigator.push(context, MaterialPageRoute(builder: (context) => const ArchiveScreen()));
                  }),
                ]),
                _buildDrawerSection('الوسائط', [
                  _drawerItem(Icons.photo_library_rounded, 'المعرض', () {
                    Navigator.pop(context);
                    Navigator.push(context, MaterialPageRoute(builder: (context) => const GalleryScreen()));
                  }),
                ]),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildDrawerHeader(BuildContext context, dynamic authUser) {
    return DrawerHeader(
      decoration: const BoxDecoration(color: Color(0xFF1A4D4E)),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Image.network(
            'https://i.imgur.com/yYZDeHZ.jpg',
            height: 60,
            fit: BoxFit.contain,
            errorBuilder: (ctx, _, __) => const Icon(Icons.business, color: Colors.white, size: 40),
          ),
          const SizedBox(height: 15),
          Text(
            'خبراء الرسم',
            style: GoogleFonts.cairo(
              color: Colors.white,
              fontSize: 18,
              fontWeight: FontWeight.bold,
            ),
          ),
          Text(
            authUser?.email ?? '',
            style: const TextStyle(color: Colors.white70, fontSize: 12),
          ),
        ],
      ),
    );
  }

  Widget _buildDrawerSection(String title, List<Widget> items) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 16, 16, 8),
          child: Text(title, style: const TextStyle(color: Colors.grey, fontWeight: FontWeight.bold, fontSize: 12)),
        ),
        ...items,
        const Divider(indent: 16, endIndent: 16),
      ],
    );
  }

  Widget _drawerItem(IconData icon, String title, VoidCallback onTap) {
    return ListTile(
      leading: Icon(icon, size: 22),
      title: Text(title, style: const TextStyle(fontSize: 14)),
      onTap: () {
        Navigator.pop(context);
        onTap();
      },
    );
  }

  Widget _buildProfilePlaceholder(BuildContext context, dynamic authUser) {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          CircleAvatar(radius: 50, child: Icon(Icons.person, size: 50)),
          const SizedBox(height: 16),
          Text(authUser?.displayName ?? 'مستخدم', style: Theme.of(context).textTheme.headlineSmall),
          const SizedBox(height: 8),
          ElevatedButton(onPressed: () => ref.read(authServiceProvider).signOut(), child: const Text('تسجيل الخروج')),
        ],
      ),
    );
  }

  Widget _buildSliverAppBar(BuildContext context, WidgetRef ref, dynamic authUser) {
    return SliverAppBar(
      expandedHeight: 120.0,
      floating: false,
      pinned: true,
      backgroundColor: const Color(0xFF1A4D4E), // Match top of gradient
      elevation: 0,
      centerTitle: true,
      title: const Text(
        'خبراء الرسم',
        style: TextStyle(fontWeight: FontWeight.w900, color: Colors.white, fontSize: 20),
      ),
      actions: [
        IconButton(
          icon: const Icon(Icons.logout_rounded, color: Colors.white70),
          onPressed: () => ref.read(authServiceProvider).signOut(),
        ),
      ],
      iconTheme: const IconThemeData(color: Colors.white),
    );
  }

  Widget _buildDashboardContent(BuildContext context, dynamic profile, dynamic authUser) {
    final displayName = profile?.name ?? authUser?.displayName ?? 'مستخدم خبير';
    final role = profile?.role?.name ?? 'موظف';

    return Padding(
      padding: const EdgeInsets.all(20.0),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _buildWelcomeSection(context, displayName, role),
          const SizedBox(height: 25),
          _buildSummarySection(context),
          const SizedBox(height: 30),
          Text(
            'الأدوات والخدمات',
            style: GoogleFonts.cairo(
              fontWeight: FontWeight.bold,
              fontSize: 20,
              color: Colors.white,
            ),
          ),
          const SizedBox(height: 15),
          GridView.count(
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            crossAxisCount: 2,
            crossAxisSpacing: 16,
            mainAxisSpacing: 16,
            childAspectRatio: 1.1,
            children: [
              _buildModernCard(
                context,
                'المشاريع',
                'إدارة وتتبع المشاريع',
                Icons.business_center_rounded,
                Colors.blue.shade600,
                () => Navigator.push(context, MaterialPageRoute(builder: (context) => const ProjectsScreen())),
              ),
              _buildModernCard(
                context,
                'المالية',
                'سندات، حسابات، تقارير',
                Icons.account_balance_wallet_rounded,
                Colors.green.shade600,
                () => Navigator.push(context, MaterialPageRoute(builder: (context) => const FinancialsScreen())),
              ),
              _buildModernCard(
                context,
                'الموظفين',
                'بيانات، عقود، مرتبات',
                Icons.people_alt_rounded,
                Colors.orange.shade600,
                () => Navigator.push(context, MaterialPageRoute(builder: (context) => const EmployeesScreen())),
              ),
              _buildModernCard(
                context,
                'التحضير الذكي',
                'الحضور والانصراف',
                Icons.camera_front_rounded,
                Colors.purple.shade600,
                () => Navigator.push(context, MaterialPageRoute(builder: (context) => const AttendanceScreen())),
              ),
              _buildModernCard(
                context,
                'المخزون',
                'الأصول والمعدات',
                Icons.inventory_2_rounded,
                Colors.teal.shade600,
                () => Navigator.push(context, MaterialPageRoute(builder: (context) => const InventoryScreen())),
              ),
              _buildModernCard(
                context,
                'المعرض',
                'صور وإنجازات المشاريع',
                Icons.photo_library_rounded,
                Colors.pink.shade600,
                () => Navigator.push(context, MaterialPageRoute(builder: (context) => const GalleryScreen())),
              ),
              _buildModernCard(
                context,
                'المساعد AI',
                'استشارات ذكية',
                Icons.auto_awesome_rounded,
                Colors.indigo.shade600,
                () => Navigator.push(context, MaterialPageRoute(builder: (context) => const SmartButlerScreen())),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildSummarySection(BuildContext context) {
    return Row(
      children: [
        Expanded(child: _buildStatItem('المشاريع', '12', Icons.assignment, Colors.orange)),
        const SizedBox(width: 12),
        Expanded(child: _buildStatItem('الموظفين', '45', Icons.people, Colors.blue)),
        const SizedBox(width: 12),
        Expanded(child: _buildStatItem('المالية', '85%', Icons.trending_up, Colors.green)),
      ],
    );
  }

  Widget _buildStatItem(String title, String value, IconData icon, Color color) {
    return Container(
      padding: const EdgeInsets.all(15),
      decoration: BoxDecoration(
        color: Colors.white.withOpacity(0.08),
        borderRadius: BorderRadius.circular(15),
        border: Border.all(color: Colors.white12),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(icon, color: color, size: 20),
          const SizedBox(height: 8),
          Text(
            value,
            style: GoogleFonts.outfit(color: Colors.white, fontSize: 18, fontWeight: FontWeight.bold),
          ),
          Text(
            title,
            style: GoogleFonts.cairo(color: Colors.white60, fontSize: 11),
          ),
        ],
      ),
    );
  }

  Widget _buildWelcomeSection(BuildContext context, String name, String role) {
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: Theme.of(context).colorScheme.surface,
        borderRadius: BorderRadius.circular(20),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.05),
            blurRadius: 10,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Row(
        children: [
          CircleAvatar(
            radius: 30,
            backgroundColor: Theme.of(context).colorScheme.primary.withOpacity(0.1),
            child: Icon(Icons.person_rounded, size: 35, color: Theme.of(context).colorScheme.primary),
          ),
          const SizedBox(width: 15),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'مرحباً بك،',
                  style: GoogleFonts.cairo(color: Colors.grey, fontSize: 14),
                ),
                Text(
                  name,
                  style: GoogleFonts.cairo(color: Colors.black87, fontWeight: FontWeight.bold, fontSize: 22),
                ),
                Text(
                  'الدور: $role',
                  style: GoogleFonts.cairo(color: const Color(0xFF2C7A7D), fontWeight: FontWeight.bold, fontSize: 12),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildModernCard(
    BuildContext context,
    String title,
    String subtitle,
    IconData icon,
    Color color,
    VoidCallback onTap,
  ) {
    return Container(
      decoration: BoxDecoration(
        color: Theme.of(context).colorScheme.surface,
        borderRadius: BorderRadius.circular(20),
        boxShadow: [
          BoxShadow(
            color: color.withOpacity(0.1),
            blurRadius: 8,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          onTap: onTap,
          borderRadius: BorderRadius.circular(20),
          child: Padding(
            padding: const EdgeInsets.all(16.0),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Container(
                  padding: const EdgeInsets.all(8),
                  decoration: BoxDecoration(
                    color: color.withOpacity(0.1),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Icon(icon, size: 28, color: color),
                ),
                const Spacer(),
                Text(
                  title,
                  style: GoogleFonts.cairo(fontSize: 16, fontWeight: FontWeight.bold),
                ),
                Text(
                  subtitle,
                  style: GoogleFonts.cairo(fontSize: 10, color: Colors.grey),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildErrorState(dynamic err) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(20.0),
        child: Text('حدث خطأ في تحميل البيانات: $err'),
      ),
    );
  }
}
