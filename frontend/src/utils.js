import { createContext, useContext, useEffect, useState } from 'react';
import { animate } from 'framer-motion';
import mammoth from 'mammoth';
import * as pdfjsLib from 'pdfjs-dist';
import pdfWorkerSrc from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerSrc;

export const API_BASE = (import.meta.env.VITE_API_URL || 'http://localhost:5000').replace(/\/$/, '');

export const chartPalette = ['#E8470A','#F06828','#F28C5E','#F5A67A','#F8C0A0','#FADBC6','#FCE8D8','#FEF2EB'];

export const topSkillBlocklist = new Set([
  'city','state','street','to','the','and','for','with','year','years',
  'experience','work','summary','objective','name','date','address','email','phone','reference',
]);

export const AppDataContext = createContext(null);
export function useAppData() { return useContext(AppDataContext); }

export function fetchJSON(path, options = {}) {
  return fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options,
  }).then(async (r) => {
    const data = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(data.error || 'Request failed');
    return data;
  });
}

export function formatNumber(v) {
  return new Intl.NumberFormat('en-US').format(v ?? 0);
}

export function sanitizeTopSkills(skills = []) {
  return skills.filter((e) => {
    const tokens = String(e.skill || '').toLowerCase().split(/\s+/).filter(Boolean);
    if (!tokens.length) return false;
    return !tokens.every((t) => topSkillBlocklist.has(t));
  });
}

export function useCountUp(value) {
  const [display, setDisplay] = useState(0);
  useEffect(() => {
    const c = animate(0, value || 0, { duration: 1, ease: 'easeOut', onUpdate(v) { setDisplay(Math.round(v)); } });
    return () => c.stop();
  }, [value]);
  return formatNumber(display);
}

export async function fetchPdfOrDocText(file) {
  const name = file.name.toLowerCase();
  const data = await file.arrayBuffer();
  if (name.endsWith('.pdf')) {
    const doc = await pdfjsLib.getDocument({ data }).promise;
    const pages = [];
    for (let i = 1; i <= doc.numPages; i++) {
      const page = await doc.getPage(i);
      const content = await page.getTextContent();
      pages.push(content.items.map((item) => item.str).join(' '));
    }
    return pages.join('\n\n');
  }
  if (name.endsWith('.docx') || name.endsWith('.doc')) {
    const result = await mammoth.extractRawText({ arrayBuffer: data });
    return result.value || '';
  }
  throw new Error('Unsupported file. Use PDF or DOCX.');
}

export const pageVariants = { initial: { opacity: 0, y: 20 }, animate: { opacity: 1, y: 0 }, exit: { opacity: 0, y: -20 } };
export const pageTransition = { duration: 0.3, ease: [0.25, 0.46, 0.45, 0.94] };
export const staggerContainer = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.06 } } };
export const fadeItem = { hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0, transition: { duration: 0.2 } } };
