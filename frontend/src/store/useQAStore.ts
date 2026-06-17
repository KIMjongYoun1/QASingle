import { create } from 'zustand';
import { toast } from 'sonner';
import type { QAData, Category, TestCase } from '../types/qa';
import { emptyQAData } from '../types/qa';
import { loadQAData, saveQAData } from '../api/qa';

const CATCOLS = ['#4f8cff', '#7c3aed', '#16a34a', '#dc2626', '#d97706', '#0891b2', '#be185d', '#0ea5e9'];

let saveTimer: ReturnType<typeof setTimeout> | null = null;

export interface PendingRunRestore {
  caseIds: string[];
  flowIds: number[];
  baseUrl: string;
  sourceLabel?: string;
}

interface QAState {
  projectId: number | null;
  data: QAData;
  loading: boolean;
  pendingRunRestore: PendingRunRestore | null;
  activeSuiteId: number | null;
  setPendingRunRestore: (r: PendingRunRestore | null) => void;
  setActiveSuiteId: (id: number | null) => void;
  setProjectId: (id: number | null) => void;
  loadProject: (id: number) => Promise<void>;
  scheduleSave: () => void;
  syncCases: () => void;
  addCase: (c: TestCase) => void;
  updateCase: (id: string, patch: Partial<TestCase>) => void;
  deleteCase: (id: string) => void;
  reorderCases: (fromIdx: number, toIdx: number) => void;
  addCategory: (name: string) => void;
  deleteCategory: (id: string) => void;
  updateExec: (mode: 'tst' | 'dep', id: string, field: string, value: string) => void;
  updateCover: (mode: 'tst' | 'dep', patch: Record<string, string>) => void;
  importCases: (cases: Partial<TestCase>[], categoryNames: string[]) => void;
  setApiBaseUrl: (url: string) => void;
  restoreReport: (
    mode: 'tst' | 'dep',
    payload: { cover?: Record<string, string>; cases: { id: string; actual: string; pf: string; owner: string; date: string; notes: string }[] },
    catNames?: Record<string, string>
  ) => void;
}

export const useQAStore = create<QAState>((set, get) => ({
  projectId: null,
  data: emptyQAData(),
  loading: false,
  pendingRunRestore: null,
  activeSuiteId: null,

  setPendingRunRestore: (r) => set({ pendingRunRestore: r }),
  setActiveSuiteId: (id) => set({ activeSuiteId: id }),

  setProjectId: (id) => set({ projectId: id, activeSuiteId: null }),

  loadProject: async (id) => {
    set({ loading: true, projectId: id });
    try {
      const loaded = await loadQAData(id);
      set({ data: loaded ?? emptyQAData(), loading: false });
    } catch (e) {
      console.error(e);
      set({ loading: false });
      toast.error('프로젝트를 불러오지 못했습니다');
    }
  },

  scheduleSave: () => {
    const { projectId, data } = get();
    if (!projectId) return;
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      saveQAData(projectId, data).catch((e) => {
        console.error(e);
        toast.error('저장에 실패했습니다');
      });
    }, 600);
  },

  syncCases: () => {
    set((state) => {
      const mgrIds = new Set(state.data.mgr.cases.map((m) => m.id));
      const tst = { ...state.data.tst, cats: state.data.mgr.cats };
      const dep = { ...state.data.dep, cats: state.data.mgr.cats };

      state.data.mgr.cases.forEach((mc) => {
        if (!tst.cases.find((tc) => tc.id === mc.id)) {
          tst.cases = [...tst.cases, { id: mc.id, catId: mc.catId, actual: mc.actual || '', pf: mc.pf || 'N/A', owner: mc.owner || '', date: mc.date || '', notes: '', evidence: [] }];
        } else {
          tst.cases = tst.cases.map((tc) => (tc.id === mc.id ? { ...tc, catId: mc.catId } : tc));
        }
        if (!dep.cases.find((dc) => dc.id === mc.id)) {
          dep.cases = [...dep.cases, { id: mc.id, catId: mc.catId, actual: '', pf: '미완료', owner: '', date: '', notes: '', evidence: [] }];
        } else {
          dep.cases = dep.cases.map((dc) => (dc.id === mc.id ? { ...dc, catId: mc.catId } : dc));
        }
      });
      tst.cases = tst.cases.filter((tc) => mgrIds.has(tc.id));
      dep.cases = dep.cases.filter((dc) => mgrIds.has(dc.id));

      return { data: { ...state.data, tst, dep } };
    });
    get().scheduleSave();
  },

  addCase: (c) => {
    set((state) => ({ data: { ...state.data, mgr: { ...state.data.mgr, cases: [...state.data.mgr.cases, c] } } }));
    get().syncCases();
  },

  updateCase: (id, patch) => {
    set((state) => ({
      data: {
        ...state.data,
        mgr: { ...state.data.mgr, cases: state.data.mgr.cases.map((c) => (c.id === id ? { ...c, ...patch } : c)) },
      },
    }));
    get().syncCases();
  },

  deleteCase: (id) => {
    set((state) => ({ data: { ...state.data, mgr: { ...state.data.mgr, cases: state.data.mgr.cases.filter((c) => c.id !== id) } } }));
    get().syncCases();
  },

  reorderCases: (fromIdx, toIdx) => {
    set((state) => {
      const arr = [...state.data.mgr.cases];
      const [moved] = arr.splice(fromIdx, 1);
      arr.splice(toIdx, 0, moved);
      return { data: { ...state.data, mgr: { ...state.data.mgr, cases: arr } } };
    });
    get().scheduleSave();
  },

  addCategory: (name) => {
    set((state) => {
      const cat: Category = { id: `mc${Date.now()}`, name, color: CATCOLS[state.data.mgr.cats.length % CATCOLS.length] };
      return { data: { ...state.data, mgr: { ...state.data.mgr, cats: [...state.data.mgr.cats, cat] } } };
    });
    get().syncCases();
  },

  deleteCategory: (id) => {
    set((state) => ({
      data: {
        ...state.data,
        mgr: {
          cats: state.data.mgr.cats.filter((c) => c.id !== id),
          cases: state.data.mgr.cases.map((c) => (c.catId === id ? { ...c, catId: '' } : c)),
        },
      },
    }));
    get().syncCases();
  },

  updateExec: (mode, id, field, value) => {
    set((state) => ({
      data: {
        ...state.data,
        [mode]: {
          ...state.data[mode],
          cases: (state.data[mode].cases as any[]).map((c) => (c.id === id ? { ...c, [field]: value } : c)),
        },
      },
    }));
    get().scheduleSave();
  },

  updateCover: (mode, patch) => {
    set((state) => ({
      data: { ...state.data, [mode]: { ...state.data[mode], cover: { ...state.data[mode].cover, ...patch } } },
    }));
    get().scheduleSave();
  },

  importCases: (cases, categoryNames) => {
    set((state) => {
      const existingCatNames = new Map(state.data.mgr.cats.map((c) => [c.name, c.id]));
      const newCats: Category[] = [...state.data.mgr.cats];
      categoryNames.forEach((name) => {
        if (name && !existingCatNames.has(name)) {
          const cat: Category = { id: `mc${Date.now()}_${Math.random().toString(36).slice(2, 7)}`, name, color: CATCOLS[newCats.length % CATCOLS.length] };
          newCats.push(cat);
          existingCatNames.set(name, cat.id);
        }
      });
      const existingIds = new Set(state.data.mgr.cases.map((c) => c.id));
      const newCases: TestCase[] = cases
        .filter((c) => c.id && !existingIds.has(c.id))
        .map((c) => ({
          id: c.id!,
          name: c.name || '',
          type: c.type || 'Positive',
          input: c.input || '',
          expected: c.expected || '',
          actual: '',
          pf: 'Pass',
          owner: '',
          date: '',
          catId: (c as any).catName ? existingCatNames.get((c as any).catName) || '' : '',
          endpoint: c.endpoint,
          method: c.method,
          expectedStatus: c.expectedStatus,
          headers: (c as any).headers,
          queryParams: (c as any).queryParams,
          body: (c as any).body,
        }));
      return { data: { ...state.data, mgr: { cats: newCats, cases: [...state.data.mgr.cases, ...newCases] } } };
    });
    get().syncCases();
  },

  setApiBaseUrl: (url) => {
    set((state) => ({ data: { ...state.data, apiBaseUrl: url } }));
    get().scheduleSave();
  },

  restoreReport: (mode, payload, catNames) => {
    set((state) => {
      const section = state.data[mode];
      const catByName = new Map(section.cats.map((c) => [c.name, c.id]));
      const restoredById = new Map(payload.cases.map((c) => [c.id, c]));
      const cases = section.cases.map((c) => {
        const r = restoredById.get(c.id);
        if (!r) return c;
        const catId = catNames?.[c.id] ? catByName.get(catNames[c.id]) ?? c.catId : c.catId;
        return { ...c, actual: r.actual, pf: r.pf as any, owner: r.owner, date: r.date, notes: r.notes, catId };
      });
      const cover = payload.cover ? { ...section.cover, ...payload.cover } : section.cover;
      return { data: { ...state.data, [mode]: { ...section, cover, cases } } };
    });
    get().scheduleSave();
  },
}));
