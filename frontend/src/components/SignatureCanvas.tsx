import React, { useRef, useState, useCallback, useEffect } from 'react';
import { Pen, Type, Upload, X, Check } from 'lucide-react';

interface SignatureCanvasProps {
  onSave: (dataUrl: string) => void;
  onCancel: () => void;
  initialImage?: string;
}

type Mode = 'draw' | 'type' | 'upload';

const SCRIPT_FONTS = [
  { name: 'Cursive', value: 'cursive' },
  { name: 'Brush Script', value: '"Brush Script MT", "Brush Script Std", cursive' },
  { name: 'Segoe Script', value: '"Segoe Script", "Comic Sans MS", cursive' },
];

const SignatureCanvas: React.FC<SignatureCanvasProps> = ({ onSave, onCancel, initialImage }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [mode, setMode] = useState<Mode>('draw');
  const [isDrawing, setIsDrawing] = useState(false);
  const [typedText, setTypedText] = useState('');
  const [selectedFont, setSelectedFont] = useState(0);
  const [preview, setPreview] = useState<string | null>(initialImage || null);

  // Clear canvas
  const clearCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setPreview(null);
  }, []);

  // Drawing handlers
  const getPos = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    if ('touches' in e) {
      return { x: e.touches[0].clientX - rect.left, y: e.touches[0].clientY - rect.top };
    }
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const startDraw = (e: React.MouseEvent | React.TouchEvent) => {
    if (mode !== 'draw') return;
    setIsDrawing(true);
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    const pos = getPos(e);
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing || mode !== 'draw') return;
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    const pos = getPos(e);
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#1a1a2e';
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
  };

  const endDraw = () => {
    setIsDrawing(false);
  };

  // Render typed signature to canvas
  useEffect(() => {
    if (mode !== 'type' || !typedText) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.font = `36px ${SCRIPT_FONTS[selectedFont].value}`;
    ctx.fillStyle = '#1a1a2e';
    ctx.textBaseline = 'middle';
    ctx.fillText(typedText, 20, canvas.height / 2);
  }, [typedText, selectedFont, mode]);

  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        const scale = Math.min(canvas.width / img.width, canvas.height / img.height);
        const w = img.width * scale;
        const h = img.height * scale;
        ctx.drawImage(img, (canvas.width - w) / 2, (canvas.height - h) / 2, w, h);
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handleSave = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dataUrl = canvas.toDataURL('image/png');
    onSave(dataUrl);
  };

  return (
    <div style={{ background: '#fff', border: '1px solid #e0e0e0', borderRadius: 8, padding: 16, width: 420 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <h3 style={{ margin: 0, fontSize: 16 }}>Signature</h3>
        <button onClick={onCancel} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={18} /></button>
      </div>

      {/* Mode tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        {([['draw', Pen, 'Draw'], ['type', Type, 'Type'], ['upload', Upload, 'Upload']] as const).map(([m, Icon, label]) => (
          <button
            key={m}
            onClick={() => { setMode(m); clearCanvas(); }}
            style={{
              flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
              padding: '6px 12px', border: '1px solid #ccc', borderRadius: 4, cursor: 'pointer',
              background: mode === m ? '#e8f0fe' : '#fff', fontWeight: mode === m ? 600 : 400,
            }}
          >
            <Icon size={14} /> {label}
          </button>
        ))}
      </div>

      {/* Canvas */}
      <canvas
        ref={canvasRef}
        width={388}
        height={120}
        onMouseDown={startDraw}
        onMouseMove={draw}
        onMouseUp={endDraw}
        onMouseLeave={endDraw}
        onTouchStart={startDraw}
        onTouchMove={draw}
        onTouchEnd={endDraw}
        style={{
          border: '1px solid #e0e0e0', borderRadius: 4, cursor: mode === 'draw' ? 'crosshair' : 'default',
          display: 'block', width: '100%', background: '#fafafa', touchAction: 'none',
        }}
      />

      {/* Type mode controls */}
      {mode === 'type' && (
        <div style={{ marginTop: 8 }}>
          <input
            type="text"
            value={typedText}
            onChange={e => setTypedText(e.target.value)}
            placeholder="Type your signature..."
            style={{ width: '100%', padding: '6px 8px', border: '1px solid #ccc', borderRadius: 4, marginBottom: 6 }}
          />
          <div style={{ display: 'flex', gap: 6 }}>
            {SCRIPT_FONTS.map((f, i) => (
              <button
                key={i}
                onClick={() => setSelectedFont(i)}
                style={{
                  flex: 1, padding: '4px 8px', border: '1px solid #ccc', borderRadius: 4,
                  fontFamily: f.value, fontSize: 14, cursor: 'pointer',
                  background: selectedFont === i ? '#e8f0fe' : '#fff',
                }}
              >
                {f.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Upload mode */}
      {mode === 'upload' && (
        <div style={{ marginTop: 8 }}>
          <input type="file" accept="image/*" onChange={handleUpload} />
        </div>
      )}

      {/* Preview */}
      {preview && (
        <div style={{ marginTop: 8 }}>
          <img src={preview} alt="Signature preview" style={{ maxWidth: '100%', maxHeight: 80, border: '1px solid #eee', borderRadius: 4 }} />
        </div>
      )}

      {/* Actions */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 12 }}>
        <button onClick={clearCanvas} style={{ padding: '6px 14px', border: '1px solid #ccc', borderRadius: 4, cursor: 'pointer', background: '#fff' }}>
          Clear
        </button>
        <button onClick={handleSave} style={{ padding: '6px 14px', border: 'none', borderRadius: 4, cursor: 'pointer', background: '#1a73e8', color: '#fff', display: 'flex', alignItems: 'center', gap: 4 }}>
          <Check size={14} /> Save
        </button>
      </div>
    </div>
  );
};

export default SignatureCanvas;
