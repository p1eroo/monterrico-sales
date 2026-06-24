export type SavedSearch = {
  id: string;
  name: string;
  type: 'personas' | 'empresas';
  query?: string;
  industry?: string;
  location?: string;
  createdAt: string;
};

const STORAGE_KEY = 'apollo-saved-searches';

export function loadSavedSearches(): SavedSearch[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveSearch(search: Omit<SavedSearch, 'id' | 'createdAt'>): SavedSearch[] {
  const all = loadSavedSearches();
  const entry: SavedSearch = {
    ...search,
    id: crypto.randomUUID?.() ?? Date.now().toString(36),
    createdAt: new Date().toISOString(),
  };
  all.push(entry);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
  return all;
}

export function removeSavedSearch(id: string): SavedSearch[] {
  const all = loadSavedSearches().filter((s) => s.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
  return all;
}