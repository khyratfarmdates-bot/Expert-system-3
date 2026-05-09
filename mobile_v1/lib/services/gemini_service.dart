import 'package:google_generative_ai/google_generative_ai.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'dart:convert';
import 'dart:typed_data';

final geminiServiceProvider = Provider<GeminiService>((ref) {
  return GeminiService();
});

class GeminiService {
  late GenerativeModel _model;
  // TODO: Use environment variable or proper config for production
  // Using a placeholder or reading from somewhere secure
  final String _apiKey = 'API_KEY_HERE'; // In a real app, do not hardcode.

  GeminiService() {
    _model = GenerativeModel(
      model: 'gemini-1.5-flash',
      apiKey: _apiKey,
    );
  }

  Future<Map<String, dynamic>?> analyzeInvoice(Uint8List imageBytes, String mimeType) async {
    try {
      final prompt = TextPart('''
        قم بتحليل الفاتورة المرفقة واستخراج المعلومات بصيغة JSON فقط:
        {
          "isValidInvoice": boolean,
          "amount": number,
          "vendor": string,
          "date": string (YYYY-MM-DD),
          "description": string
        }
      ''');

      final imagePart = DataPart(mimeType, imageBytes);
      final content = Content.multi([prompt, imagePart]);

      final response = await _model.generateContent([content]);
      final text = response.text;
      
      if (text != null && text.isNotEmpty) {
        // Find JSON block if wrapped in markdown
        String jsonStr = text;
        if (text.contains('```json')) {
          final start = text.indexOf('```json') + 7;
          final end = text.lastIndexOf('```');
          jsonStr = text.substring(start, end);
        }
        return jsonDecode(jsonStr.trim());
      }
      return null;
    } catch (e) {
      print('Error analyzing invoice: \$e');
      return null;
    }
  }

  Future<String> chatWithButler(String message) async {
    try {
      final prompt = 'أنت مساعد ذكي (Smart Butler) متخصص في إدارة المشاريع والموارد البشرية والشؤون المالية، تحدث باللغة العربية بأسلوب احترافي ومساعد. إليك سؤال المستخدم: $message';
      final response = await _model.generateContent([Content.text(prompt)]);
      return response.text ?? 'عذراً، لم أتمكن من الرد.';
    } catch (e) {
      print('Error chatting: \$e');
      return 'حدث خطأ في الاتصال بالمساعد الذكي.';
    }
  }
}
