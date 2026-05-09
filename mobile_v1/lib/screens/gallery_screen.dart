import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

class GalleryScreen extends StatelessWidget {
  const GalleryScreen({super.key});

  @override
  Widget build(BuildContext context) {
    // Mock data for project images
    final List<String> projectImages = [
      'https://images.unsplash.com/photo-1541888946425-d81bb19480c5?q=80&w=500',
      'https://images.unsplash.com/photo-1503387762-592dee58c460?q=80&w=500',
      'https://images.unsplash.com/photo-1581094794329-c8112a89af12?q=80&w=500',
      'https://images.unsplash.com/photo-1590644365607-1c5a519a7a37?q=80&w=500',
      'https://images.unsplash.com/photo-1531834351336-e414c77f03d3?q=80&w=500',
      'https://images.unsplash.com/photo-1591389052441-2a91176b663b?q=80&w=500',
    ];

    return Scaffold(
      appBar: AppBar(
        title: Text('معرض الأعمال', style: GoogleFonts.cairo(fontWeight: FontWeight.bold)),
        centerTitle: true,
      ),
      body: GridView.builder(
        padding: const EdgeInsets.all(16),
        gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
          crossAxisCount: 2,
          crossAxisSpacing: 12,
          mainAxisSpacing: 12,
          childAspectRatio: 1,
        ),
        itemCount: projectImages.length,
        itemBuilder: (context, index) {
          return ClipRRect(
            borderRadius: BorderRadius.circular(15),
            child: Stack(
              fit: StackFit.expand,
              children: [
                Image.network(
                  projectImages[index],
                  fit: BoxFit.cover,
                ),
                Container(
                  decoration: BoxDecoration(
                    gradient: LinearGradient(
                      begin: Alignment.topCenter,
                      end: Alignment.bottomCenter,
                      colors: [Colors.transparent, Colors.black.withOpacity(0.7)],
                    ),
                  ),
                ),
                Positioned(
                  bottom: 10,
                  left: 10,
                  right: 10,
                  child: Text(
                    'مشروع رقم ${index + 1}',
                    style: GoogleFonts.cairo(color: Colors.white, fontSize: 12, fontWeight: FontWeight.bold),
                    textAlign: TextAlign.center,
                  ),
                ),
              ],
            ),
          );
        },
      ),
    );
  }
}
