import React, { useState } from 'react';
import { Printer } from 'lucide-react';

interface EnvelopeSize {
  name: string;
  width: string;
  height: string;
  widthIn: number;
  heightIn: number;
}

const ENVELOPE_SIZES: EnvelopeSize[] = [
  { name: '#10 (Standard)', width: '9.5in', height: '4.125in', widthIn: 9.5, heightIn: 4.125 },
  { name: 'DL', width: '8.66in', height: '4.33in', widthIn: 8.66, heightIn: 4.33 },
  { name: 'C5', width: '9.02in', height: '6.38in', widthIn: 9.02, heightIn: 6.38 },
  { name: 'C4', width: '12.76in', height: '9.02in', widthIn: 12.76, heightIn: 9.02 },
  { name: 'Monarch', width: '7.5in', height: '3.875in', widthIn: 7.5, heightIn: 3.875 },
];

interface EnvelopePrinterProps {
  onClose: () => void;
}

const EnvelopePrinter: React.FC<EnvelopePrinterProps> = ({ onClose }) => {
  const [sizeIdx, setSizeIdx] = useState(0);
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [returnAddress, setReturnAddress] = useState('');
  const [deliveryFont, setDeliveryFont] = useState('Arial');
  const [deliveryFontSize, setDeliveryFontSize] = useState(14);
  const [returnFont, setReturnFont] = useState('Arial');
  const [returnFontSize, setReturnFontSize] = useState(10);
  const [showBarcode, setShowBarcode] = useState(false);
  const size = ENVELOPE_SIZES[sizeIdx];
  const fonts = ['Arial', 'Times New Roman', 'Courier New', 'Georgia', 'Verdana', 'Helvetica'];

  const handlePrint = () => {
    const w = window.open('', '_blank');
    if (!w) return;
    w.document.write(`<!DOCTYPE html><html><head><style>
      @page { size: ${size.width} ${size.height}; margin: 0; }
      * { margin: 0; padding: 0; box-sizing: border-box; }
      body { width: ${size.width}; height: ${size.height}; position: relative; }
      .return-addr { position: absolute; top: 0.5in; left: 0.5in; font-family: ${returnFont}; font-size: ${returnFontSize}pt; white-space: pre-wrap; }
      .delivery-addr { position: absolute; top: 45%; left: 50%; transform: translate(-50%, -50%); font-family: ${deliveryFont}; font-size: ${deliveryFontSize}pt; white-space: pre-wrap; text-align: center; }
      .barcode { position: absolute; bottom: 0.5in; left: 50%; transform: translateX(-50%); display: flex; gap: 2px; align-items: flex-end; }
      .barcode .bar { background: #000; }
    </style></head><body>
      <div class="return-addr">${returnAddress.replace(/</g, '&lt;')}</div>
      <div class="delivery-addr">${deliveryAddress.replace(/</g, '&lt;')}</div>
      ${showBarcode ? `<div class="barcode">${Array.from({ length: 32 }, (_, i) => `<div class="bar" style="width:${i % 3 === 0 ? 3 : 1}px;height:${12 + (i % 5) * 2}px"></div>`).join('')}</div>` : ''}
    </body></html>`);
    w.document.close();
    w.print();
  };

  const previewScale = 0.6;
  const previewW = size.widthIn * 96 * previewScale;
  const previewH = size.heightIn * 96 * previewScale;

  return (
    <div style={{ padding: 24 }}>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
          <div>
            <label style={{ fontWeight: 600, fontSize: 13 }}>Envelope Size</label>
            <select value={sizeIdx} onChange={e => setSizeIdx(+e.target.value)} style={{ width: '100%', padding: 6, marginTop: 4 }}>
              {ENVELOPE_SIZES.map((s, i) => <option key={i} value={i}>{s.name} ({s.width} × {s.height})</option>)}
            </select>
          </div>
          <div>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, marginTop: 20 }}>
              <input type="checkbox" checked={showBarcode} onChange={e => setShowBarcode(e.target.checked)} />
              Show USPS barcode (mock)
            </label>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
          <div>
            <label style={{ fontWeight: 600, fontSize: 13 }}>Return Address</label>
            <textarea value={returnAddress} onChange={e => setReturnAddress(e.target.value)} rows={3} style={{ width: '100%', marginTop: 4, padding: 6, fontFamily: returnFont, fontSize: returnFontSize }} placeholder="Your Name&#10;123 Main St&#10;City, ST 12345" />
            <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
              <select value={returnFont} onChange={e => setReturnFont(e.target.value)} style={{ flex: 1, padding: 4, fontSize: 12 }}>
                {fonts.map(f => <option key={f} value={f}>{f}</option>)}
              </select>
              <input type="number" value={returnFontSize} onChange={e => setReturnFontSize(+e.target.value)} min={8} max={24} style={{ width: 50, padding: 4, fontSize: 12 }} />
            </div>
          </div>
          <div>
            <label style={{ fontWeight: 600, fontSize: 13 }}>Delivery Address</label>
            <textarea value={deliveryAddress} onChange={e => setDeliveryAddress(e.target.value)} rows={3} style={{ width: '100%', marginTop: 4, padding: 6, fontFamily: deliveryFont, fontSize: deliveryFontSize }} placeholder="Recipient Name&#10;456 Oak Ave&#10;City, ST 67890" />
            <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
              <select value={deliveryFont} onChange={e => setDeliveryFont(e.target.value)} style={{ flex: 1, padding: 4, fontSize: 12 }}>
                {fonts.map(f => <option key={f} value={f}>{f}</option>)}
              </select>
              <input type="number" value={deliveryFontSize} onChange={e => setDeliveryFontSize(+e.target.value)} min={8} max={36} style={{ width: 50, padding: 4, fontSize: 12 }} />
            </div>
          </div>
        </div>

        <div style={{ marginBottom: 16 }}>
          <label style={{ fontWeight: 600, fontSize: 13 }}>Preview</label>
          <div style={{ marginTop: 8, border: '1px solid #ccc', background: '#fff', color: '#000', width: previewW, height: previewH, position: 'relative', margin: '8px auto' }}>
            <div style={{ position: 'absolute', top: '8%', left: '5%', fontFamily: returnFont, fontSize: returnFontSize * previewScale, whiteSpace: 'pre-wrap', color: '#000' }}>
              {returnAddress || 'Return Address'}
            </div>
            <div style={{ position: 'absolute', top: '45%', left: '50%', transform: 'translate(-50%,-50%)', fontFamily: deliveryFont, fontSize: deliveryFontSize * previewScale, whiteSpace: 'pre-wrap', textAlign: 'center', color: '#000' }}>
              {deliveryAddress || 'Delivery Address'}
            </div>
            {showBarcode && (
              <div style={{ position: 'absolute', bottom: '8%', left: '50%', transform: 'translateX(-50%)', display: 'flex', gap: 1, alignItems: 'flex-end' }}>
                {Array.from({ length: 32 }, (_, i) => (
                  <div key={i} style={{ background: '#000', width: i % 3 === 0 ? 2 : 1, height: 8 + (i % 5) * 1.5 }} />
                ))}
              </div>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button onClick={onClose} style={{ padding: '8px 16px', borderRadius: 4, border: '1px solid #ccc', background: 'transparent', cursor: 'pointer' }}>Cancel</button>
          <button onClick={handlePrint} style={{ padding: '8px 16px', borderRadius: 4, border: 'none', background: '#1a73e8', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
            <Printer size={16} /> Print Envelope
          </button>
        </div>
    </div>
  );
};

export default EnvelopePrinter;
