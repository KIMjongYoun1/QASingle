import { create } from 'zustand';
import { toast } from 'sonner';
import type { QAData, Category, KV, TestCase } from '../types/qa';
import { emptyQAData } from '../types/qa';
import { loadQAData, saveQAData, importCasesApi, reorderCasesApi, restoreSectionApi } from '../api/qa';

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
  clearAllCases: () => void;
  reorderCases: (fromIdx: number, toIdx: number) => Promise<void>;
  addCategory: (name: string) => void;
  deleteCategory: (id: string) => void;
  updateCategory: (id: string, name: string) => void;
  updateExec: (mode: 'tst' | 'dep', id: string, field: string, value: string) => void;
  updateCover: (mode: 'tst' | 'dep', patch: Record<string, string>) => void;
  importCases: (cases: Partial<TestCase>[], categoryNames: string[]) => Promise<void>;
  setApiBaseUrl: (url: string) => void;
  setApiHeaders: (headers: KV[]) => void;
  restoreReport: (
    mode: 'tst' | 'dep',
    payload: { cover?: Record<string, string>; cases: { id: string; actual: string; pf: string; owner: string; date: string; notes: string }[] },
    catNames?: Record<string, string>
  ) => Promise<void>;
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

  // 백엔드 save가 sync 후 canonical 데이터를 반환하면 스토어를 갱신
  scheduleSave: () => {
    const { projectId, data } = get();
    if (!projectId) return;
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(async () => {
      try {
        const synced = await saveQAData(projectId, data);
        if (synced) set({ data: synced });
      } catch (e) {
        console.error(e);
        toast.error('저장에 실패했습니다');
      }
    }, 600);
  },

  // 낙관적 로컬 sync — 즉각적인 UI 반응용 (백엔드가 최종 정합성 보장)
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

  clearAllCases: () => {
    set((state) => ({ data: { ...state.data, mgr: { ...state.data.mgr, cases: [] } } }));
    get().syncCases();
  },

  // 낙관적 로컬 업데이트 후 백엔드에서 순서 확정
  reorderCases: async (fromIdx, toIdx) => {
    set((state) => {
      const arr = [...state.data.mgr.cases];
      const [moved] = arr.splice(fromIdx, 1);
      arr.splice(toIdx, 0, moved);
      return { data: { ...state.data, mgr: { ...state.data.mgr, cases: arr } } };
    });

    const { projectId, data } = get();
    if (!projectId) return;
    try {
      const synced = await reorderCasesApi(projectId, data.mgr.cases.map((c) => c.id));
      set({ data: synced });
    } catch (e) {
      console.error(e);
      toast.error('순서 저장에 실패했습니다');
    }
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

  updateCategory: (id, name) => {
    set((state) => ({
      data: {
        ...state.data,
        mgr: { ...state.data.mgr, cats: state.data.mgr.cats.map((c) => (c.id === id ? { ...c, name } : c)) },
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

  // 백엔드에서 카테고리 생성·ID 중복 제거·sync 처리
  importCases: async (cases, categoryNames) => {
    const { projectId } = get();
    if (!projectId) return;
    try {
      const synced = await importCasesApi(projectId, cases, categoryNames);
      set({ data: synced });
    } catch (e) {
      console.error(e);
      throw e; // 호출자(AutoRunPage, ExcelImportModal)가 toast 처리
    }
  },

  setApiBaseUrl: (url) => {
    set((state) => ({ data: { ...state.data, apiBaseUrl: url } }));
    get().scheduleSave();
  },

  setApiHeaders: (headers) => {
    set((state) => ({ data: { ...state.data, apiHeaders: headers } }));
    get().scheduleSave();
  },

  // 백엔드에서 섹션 복원 처리
  restoreReport: async (mode, payload, catNames) => {
    const { projectId } = get();
    if (!projectId) return;
    const synced = await restoreSectionApi(projectId, mode, {
      cover: payload.cover,
      cases: payload.cases as any,
      cat_names: catNames,
    });
    set({ data: synced });
  },
}));
