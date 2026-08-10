// Category badge background + text color tokens
export const CATEGORY_COLORS: Record<string, { bg: string; text: string; dot: string }> = {
  forum:        { bg: 'bg-blue-100',    text: 'text-blue-700',   dot: 'bg-blue-400' },
  promotions:   { bg: 'bg-pink-100',    text: 'text-pink-700',   dot: 'bg-pink-400' },
  social_media: { bg: 'bg-emerald-100', text: 'text-emerald-700', dot: 'bg-emerald-400' },
  spam:         { bg: 'bg-red-100',     text: 'text-red-700',    dot: 'bg-red-400' },
  updates:      { bg: 'bg-indigo-100',  text: 'text-indigo-700', dot: 'bg-indigo-400' },
  verify_code:  { bg: 'bg-amber-100',   text: 'text-amber-700',  dot: 'bg-amber-400' },
  oportunities: { bg: 'bg-teal-100',    text: 'text-teal-700',   dot: 'bg-teal-400' },
  finance:      { bg: 'bg-slate-100',   text: 'text-slate-700',  dot: 'bg-slate-400' },
  college:      { bg: 'bg-violet-100',  text: 'text-violet-700', dot: 'bg-violet-400' },
}

export const PRIORITY_COLORS: Record<string, { bg: string; text: string }> = {
  high:   { bg: 'bg-red-100',   text: 'text-red-600' },
  medium: { bg: 'bg-amber-100', text: 'text-amber-600' },
  low:    { bg: 'bg-slate-100', text: 'text-slate-500' },
}

export const formatCategory = (cat: string) =>
  cat.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
