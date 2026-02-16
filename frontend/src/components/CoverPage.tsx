import React, { useState, useCallback } from 'react';
import { X, Upload } from 'lucide-react';

type TemplateName = 'academic' | 'business' | 'creative' | 'minimal' | 'report' | 'resume';

interface CoverPageData {
  title: string;
  subtitle: string;
  author: string;
  date: string;
  organization: string;
  logo: string | null;
  template: TemplateName;
  bgColor: string;
  bgGradient: string;
}

const TEMPLATES: Record<TemplateName, { label: string; description: string; style: React.CSSProperties }> = {
  academic: {
    label: 'Academic',
    description: 'Clean serif layout for papers and theses',
    style: { fontFamily: 'Georgia, serif', textAlign: 'center', paddingTop: 120 },
  },
  business: {
    label: 'Business',
    description: 'Professional sans-serif with accent bar',
    style: { fontFamily: 'Arial, sans-serif', textAlign: 'left', paddingTop: 80, paddingLeft: 60 },
  },
  creative: {
    label: 'Creative',
    description: 'Bold colors with large typography',
    style: { fontFamily: '"Segoe UI", sans-serif', textAlign: 'center', paddingTop: 100 },
  },
  minimal: {
    label: 'Minimal',
    description: 'Simple centered layout',
    style: { fontFamily: 'Helvetica, sans-serif', textAlign: 'center', paddingTop: 200 },
  },
  report: {
    label: 'Report',
    description: 'Structured layout with date and org',
    style: { fontFamily: 'Cambria, serif', textAlign: 'center', paddingTop: 100 },
  },
  resume: {
    label: 'Resume',
    description: 'Name-focused header layout',
    style: { fontFamily: '"Calibri", sans-serif', textAlign: 'center', paddingTop: 60 },
  },
};

interface CoverPageProps {
  editor: any;
  onClose: () => void;
}

const CoverPage: React.FC<CoverPageProps> = ({ editor, onClose }) => {
  const [data, setData] = useState<CoverPageData>({
    title: 'Document Title',
    subtitle: 'Subtitle',
    author: '',
    date: new Date().toLocaleDateString(),
    organization: '',
    logo: null,
    template: 'minimal',
    bgColor: '#ffffff',
    bgGradient: '',
  });

  const handleLogoUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setData((d) => ({ ...d, logo: reader.result as string }));
    reader.readAsDataURL(file);
  }, []);

  const handleLogoDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (!file || !file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = () => setData((d) => ({ ...d, logo: reader.result as string }));
    reader.readAsDataURL(file);
  }, []);

  const insertCoverPage = () => {
    if (!editor) return;
    const bg = data.bgGradient || data.bgColor;
    const tpl = TEMPLATES[data.template];

    const logoHtml = data.logo
      ? `<img src="${data.logo}" style="max-width:150px;max-height:100px;margin-bottom:20px;" alt="Logo" /><br/>`
      : '';

    const html = `
      <div data-cover-page="true" style="page-break-after:always;min-height:90vh;background:${bg};padding:40px;${Object.entries(tpl.style).map(([k, v]) => `${k.replace(/([A-Z])/g, '-$1').toLowerCase()}:${v}`).join(';')}">
        ${logoHtml}
        <h1 style="font-size:2.5em;margin-bottom:8px;">${data.title}</h1>
        ${data.subtitle ? `<h2 style="font-size:1.4em;font-weight:normal;color:#666;margin-bottom:24px;">${data.subtitle}</h2>` : ''}
        ${data.author ? `<p style="font-size:1.1em;margin:4px 0;">${data.author}</p>` : ''}
        ${data.organization ? `<p style="font-size:1em;color:#888;margin:4px 0;">${data.organization}</p>` : ''}
        ${data.date ? `<p style="font-size:1em;color:#888;margin:16px 0;">${data.date}</p>` : ''}
      </div>
    `;

    // Insert at the very beginning of the document
    editor.chain().focus().insertContentAt(0, html).run();
    onClose();
  };

  const update = (key: keyof CoverPageData, value: string) =>
    setData((d) => ({ ...d, [key]: value }));

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(0,0,0,0.3)', display: 'flex', alignItems: 'center',
      justifyContent: 'center', zIndex: 10000,
    }} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{
        background: 'white', borderRadius: 8, padding: 24, width: 560,
        maxHeight: '90vh', overflow: 'auto', boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h3 style={{ margin: 0 }}>Insert Cover Page</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
            <X size={18} />
          </button>
        </div>

        {/* Template picker */}
        <div style={{ marginBottom: 16 }}>
          <label style={{ fontWeight: 600, fontSize: 13, display: 'block', marginBottom: 6 }}>Template</label>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
            {(Object.entries(TEMPLATES) as [TemplateName, typeof TEMPLATES[TemplateName]][]).map(([key, tpl]) => (
              <button
                key={key}
                onClick={() => update('template', key)}
                style={{
                  padding: '8px', border: data.template === key ? '2px solid #4285f4' : '1px solid #ddd',
                  borderRadius: 6, cursor: 'pointer', background: data.template === key ? '#e8f0fe' : '#fafafa',
                  fontSize: 12, textAlign: 'center',
                }}
              >
                <div style={{ fontWeight: 600 }}>{tpl.label}</div>
                <div style={{ color: '#888', fontSize: 10 }}>{tpl.description}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Fields */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 16 }}>
          {(['title', 'subtitle', 'author', 'date', 'organization'] as const).map((field) => (
            <label key={field} style={{ fontSize: 13, display: 'flex', flexDirection: 'column', gap: 2 }}>
              <span style={{ fontWeight: 600, textTransform: 'capitalize' }}>{field}</span>
              <input
                type="text"
                value={data[field]}
                onChange={(e) => update(field, e.target.value)}
                style={{ padding: '6px 8px', border: '1px solid #ddd', borderRadius: 4, fontSize: 13 }}
              />
            </label>
          ))}
        </div>

        {/* Logo */}
        <div style={{ marginBottom: 16 }}>
          <label style={{ fontWeight: 600, fontSize: 13, display: 'block', marginBottom: 6 }}>Logo</label>
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleLogoDrop}
            style={{
              border: '2px dashed #ddd', borderRadius: 6, padding: 16, textAlign: 'center',
              color: '#999', cursor: 'pointer', position: 'relative',
            }}
            onClick={() => document.getElementById('cover-logo-input')?.click()}
          >
            {data.logo ? (
              <img src={data.logo} alt="Logo" style={{ maxWidth: 120, maxHeight: 80 }} />
            ) : (
              <span><Upload size={16} style={{ verticalAlign: 'middle' }} /> Drop or click to upload logo</span>
            )}
            <input id="cover-logo-input" type="file" accept="image/*" onChange={handleLogoUpload}
              style={{ display: 'none' }} />
          </div>
        </div>

        {/* Background */}
        <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
          <label style={{ fontSize: 13 }}>
            <span style={{ fontWeight: 600 }}>Background Color</span><br />
            <input type="color" value={data.bgColor} onChange={(e) => update('bgColor', e.target.value)}
              style={{ width: 40, height: 28, border: 'none', cursor: 'pointer' }} />
          </label>
          <label style={{ fontSize: 13, flex: 1 }}>
            <span style={{ fontWeight: 600 }}>Gradient (CSS)</span><br />
            <input type="text" value={data.bgGradient} onChange={(e) => update('bgGradient', e.target.value)}
              placeholder="e.g. linear-gradient(135deg, #667eea, #764ba2)"
              style={{ padding: '6px 8px', border: '1px solid #ddd', borderRadius: 4, fontSize: 12, width: '100%' }} />
          </label>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button onClick={onClose} style={{ padding: '8px 16px', border: '1px solid #ddd', borderRadius: 4, cursor: 'pointer' }}>
            Cancel
          </button>
          <button onClick={insertCoverPage} style={{
            padding: '8px 16px', border: 'none', borderRadius: 4, cursor: 'pointer',
            background: '#4285f4', color: 'white', fontWeight: 600,
          }}>
            Insert
          </button>
        </div>
      </div>
    </div>
  );
};

export default CoverPage;
