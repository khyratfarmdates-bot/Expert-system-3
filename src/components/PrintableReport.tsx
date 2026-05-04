import React from 'react';
import { Card } from '@/components/ui/card';

interface ReportField {
  label: string;
  value: any;
  type?: 'number' | 'text' | 'date';
}

interface PrintableReportProps {
  id: string;
  title: string;
  subtitle?: string;
  headers: string[];
  data: any[][];
  summary?: { label: string; value: string }[];
}

export default function PrintableReport({ id, title, subtitle, headers, data, summary }: PrintableReportProps) {
  // Hex colors for stable rendering
  const colors = {
    primary: '#2c7a7d',
    primaryLight: '#f0f7f7',
    primaryBorder: '#c2dedd',
    textMain: '#1a1a1a',
    textMuted: '#4b5563',
    slate50: '#f9fafb',
    slate100: '#f3f4f6',
    slate200: '#e5e7eb',
    slate700: '#374151',
    slate800: '#1f2937',
    slate900: '#111827',
    emerald700: '#047857'
  };

  return (
    <div 
      id={id} 
      className="bg-white" 
      style={{ 
        width: '210mm', 
        minHeight: '297mm', 
        padding: '20mm',
        position: 'absolute', 
        left: '-10000px', 
        top: 0,
        direction: 'rtl',
        fontFamily: "'Cairo', sans-serif",
        color: colors.textMain,
        boxSizing: 'border-box',
        WebkitFontSmoothing: 'antialiased',
        textRendering: 'optimizeLegibility',
        letterSpacing: 'normal' // Explicitly normal to prevent html2canvas character splitting
      }}
    >
      {/* HEADER SECTION - Stable Table Layout */}
      <table style={{ width: '100%', marginBottom: '30px', borderCollapse: 'collapse' }}>
        <tbody>
          <tr>
            <td style={{ width: '60%', verticalAlign: 'top', textAlign: 'right' }}>
              <div style={{ display: 'inline-block', borderRight: `5px solid ${colors.primary}`, paddingRight: '15px' }}>
                <h1 style={{ fontSize: '32px', fontWeight: 900, color: colors.primary, margin: '0 0 5px 0', lineHeight: '1.2' }}>مؤسسة خبراء الرسم</h1>
                <p style={{ fontSize: '10px', fontWeight: 800, color: colors.textMuted, margin: 0, textTransform: 'uppercase', letterSpacing: '2px', opacity: 0.7 }}>EXPERTS OF PAINTING FOUNDATION</p>
                <div style={{ marginTop: '10px' }}>
                  <span style={{ fontSize: '10px', padding: '3px 10px', backgroundColor: colors.slate100, borderRadius: '4px', fontWeight: 'bold', color: colors.slate700, marginLeft: '5px', border: `1px solid ${colors.slate200}` }}>فرع الرياض</span>
                  <span style={{ fontSize: '10px', padding: '3px 10px', backgroundColor: '#ecfdf5', borderRadius: '4px', fontWeight: 'bold', color: colors.emerald700, border: '1px solid #d1fae5' }}>مستند موثق</span>
                </div>
              </div>
            </td>
            <td style={{ width: '40%', verticalAlign: 'top', textAlign: 'left' }}>
              <div style={{ display: 'inline-block', textAlign: 'left' }}>
                <img 
                  src="https://i.imgur.com/yYZDeHZ.jpg" 
                  alt="Logo" 
                  style={{ width: '100px', height: '100px', borderRadius: '12px', border: `2px solid ${colors.primary}`, padding: '2px', backgroundColor: '#fff', marginBottom: '10px', objectFit: 'contain' }}
                  referrerPolicy="no-referrer"
                />
              </div>
            </td>
          </tr>
        </tbody>
      </table>

      {/* DOCUMENT TITLE BAR */}
      <div style={{ backgroundColor: colors.slate900, color: '#fff', padding: '15px 25px', borderRadius: '12px', marginBottom: '30px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '22px', fontWeight: 900 }}>{title}</h2>
          {subtitle && <p style={{ margin: '5px 0 0 0', fontSize: '12px', opacity: 0.8 }}>{subtitle}</p>}
        </div>
        <div style={{ textAlign: 'left', fontSize: '10px', fontWeight: 'bold', opacity: 0.8 }}>
          <p style={{ margin: 0 }}>تاريخ الإصدار: {new Date().toLocaleDateString('ar-SA')}</p>
          <p style={{ margin: '3px 0 0 0' }}>رقم المرجع: #XP-{Date.now().toString().slice(-6)}</p>
        </div>
      </div>

      {/* SUMMARY CARDS - Stable Grid Equivalent */}
      {summary && summary.length > 0 && (
        <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: '15px 0', marginBottom: '30px', marginRight: '-15px' }}>
          <tbody>
            <tr>
              {summary.map((item, idx) => (
                <td key={idx} style={{ width: `${100/summary.length}%`, padding: 0 }}>
                  <div style={{ backgroundColor: colors.primaryLight, border: `1px solid ${colors.primaryBorder}`, borderRadius: '12px', padding: '15px', textAlign: 'center' }}>
                    <p style={{ margin: '0 0 8px 0', fontSize: '11px', fontWeight: 800, color: colors.primary, textTransform: 'uppercase' }}>{item.label}</p>
                    <p style={{ margin: 0, fontSize: '20px', fontWeight: 900, color: colors.slate900 }}>{item.value}</p>
                  </div>
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      )}

      {/* MAIN DATA TABLE */}
      <div style={{ borderRadius: '12px', overflow: 'hidden', border: `1px solid ${colors.slate200}`, marginBottom: '40px' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'right' }}>
          <thead>
            <tr style={{ backgroundColor: colors.slate100 }}>
              {headers.map((header, idx) => (
                <th key={idx} style={{ padding: '15px', fontSize: '12px', fontWeight: 900, color: colors.slate800, borderBottom: `2px solid ${colors.slate200}` }}>{header}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map((row, rowIdx) => (
              <tr key={rowIdx} style={{ backgroundColor: rowIdx % 2 === 0 ? '#fff' : colors.slate50 }}>
                {row.map((cell, cellIdx) => (
                  <td key={cellIdx} style={{ padding: '12px 15px', fontSize: '11px', fontWeight: 600, color: colors.slate700, borderBottom: `1px solid ${colors.slate100}`, verticalAlign: 'top', whiteSpace: 'normal', wordBreak: 'break-word' }}>
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* LEGAL NOTES */}
      <div style={{ padding: '20px', backgroundColor: colors.slate50, borderRadius: '12px', border: `1px solid ${colors.slate200}`, marginBottom: '50px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
          <div style={{ width: '4px', height: '18px', backgroundColor: colors.primary, borderRadius: '2px' }} />
          <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 900, color: colors.primary }}>ملاحظات التقرير والبيان القانوني</h3>
        </div>
        <p style={{ margin: 0, fontSize: '11px', lineHeight: '1.8', color: colors.textMuted, fontWeight: 500 }}>
          • هذا التقرير مستخرج آلياً من نظام (X-Painter ERP) ويعتبر وثيقة رسمية وحجة على البيانات المدخلة في تاريخه.<br/>
          • يلزم وجود الختم الحي والتوقيع المعتمد لإضفاء الصفة الرسمية الكاملة على هذا المستند.<br/>
          • في حال وجود أي اعتراض أو اختلاف في البيانات، يرجى مراجعة الإدارة المالية في مدة أقصاها 7 أيام من تاريخه.
        </p>
      </div>

      {/* SIGNATURE SECTION */}
      <table style={{ width: '100%', marginTop: 'auto' }}>
        <tbody>
          <tr>
            <td style={{ width: '33%', textAlign: 'center' }}>
              <p style={{ margin: '0 0 40px 0', fontSize: '12px', fontWeight: 900, borderBottom: `1px solid ${colors.slate200}`, paddingBottom: '8px', display: 'inline-block', width: '80%' }}>المدير العام</p>
              <div style={{ fontSize: '9px', color: colors.slate200, fontWeight: 'bold' }}>توقيع معتمد</div>
            </td>
            <td style={{ width: '34%', textAlign: 'center', verticalAlign: 'middle' }}>
              <div style={{ width: '120px', height: '120px', borderRadius: '50%', border: `2px dashed ${colors.primary}`, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', opacity: 0.1, transform: 'rotate(-15deg)' }}>
                <div style={{ textAlign: 'center', fontSize: '10px', fontWeight: 900 }}>ختم المؤسسة<br/>EXPERTS<br/>2026</div>
              </div>
            </td>
            <td style={{ width: '33%', textAlign: 'center' }}>
              <p style={{ margin: '0 0 40px 0', fontSize: '12px', fontWeight: 900, borderBottom: `1px solid ${colors.slate200}`, paddingBottom: '8px', display: 'inline-block', width: '80%' }}>المحاسب المسؤول</p>
              <div style={{ fontSize: '9px', color: colors.slate200, fontWeight: 'bold' }}>ختم الإدارة المالية</div>
            </td>
          </tr>
        </tbody>
      </table>

      {/* FOOTER */}
      <div style={{ position: 'absolute', bottom: '20mm', left: '20mm', right: '20mm', paddingTop: '15px', borderTop: `1px solid ${colors.slate100}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '9px', fontWeight: 'bold', color: '#9ca3af', textTransform: 'uppercase' }}>
        <span>www.experts-painting.sa</span>
        <span style={{ color: colors.primary }}>مؤسسة خبراء الرسم - فرع الرياض</span>
        <span>X-Painter Cloud System v2.1</span>
      </div>

      {/* Branding Watermark */}
      <div style={{ position: 'absolute', bottom: '20mm', left: '20mm', opacity: 0.03, transform: 'rotate(-12deg)', pointerEvents: 'none' }}>
        <h1 style={{ fontSize: '120px', fontWeight: 900, color: colors.primary, margin: 0 }}>EXPERTS</h1>
      </div>
    </div>
  );
}
