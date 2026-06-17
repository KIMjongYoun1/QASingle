export type PF = 'Pass' | 'Fail' | 'N/A';
export type DepPF = '완료' | '미완료' | '스킵';
export type CaseType = 'Positive' | 'Negative';

export interface Category {
  id: string;
  name: string;
  color: string;
}

export interface KV {
  key: string;
  value: string;
}

export interface TestCase {
  id: string;
  name: string;
  type: CaseType;
  input: string;
  expected: string;
  actual: string;
  pf: PF;
  owner: string;
  date: string;
  catId: string;
  endpoint?: string;
  method?: string;
  expectedStatus?: number;
  headers?: KV[];
  queryParams?: KV[];
  body?: string;
}

export interface TstExecution {
  id: string;
  catId: string;
  actual: string;
  pf: PF;
  owner: string;
  date: string;
  notes: string;
  evidence: string[];
}

export interface DepExecution {
  id: string;
  catId: string;
  actual: string;
  pf: DepPF;
  owner: string;
  date: string;
  notes: string;
  evidence: string[];
}

export interface TstCover {
  company: string;
  project: string;
  system: string;
  version: string;
  docNumber: string;
  start: string;
  end: string;
  environment: string;
  author: string;
  approver: string;
  date: string;
}

export interface DepCover {
  company: string;
  project: string;
  version: string;
  environment: string;
  docNumber: string;
  deployType: string;
  start: string;
  end: string;
  deployer: string;
  approver: string;
  date: string;
  target: string;
  summary: string;
}

export interface QAData {
  mgr: { cats: Category[]; cases: TestCase[] };
  tst: { cover: TstCover; cats: Category[]; cases: TstExecution[] };
  dep: { cover: DepCover; cats: Category[]; cases: DepExecution[] };
  apiBaseUrl?: string;
}

export interface Project {
  id: number;
  name: string;
  created_at?: string;
}

export interface FlowStep {
  case_id: string;
  order: number;
}

export interface TestFlow {
  id: number;
  name: string;
  steps: FlowStep[];
}

export function emptyQAData(): QAData {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const todStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`;
  return {
    mgr: { cats: [], cases: [] },
    tst: {
      cover: { company: '', project: '', system: '', version: 'v1.0', docNumber: '', start: '', end: '', environment: '', author: '', approver: '', date: todStr },
      cats: [],
      cases: [],
    },
    dep: {
      cover: { company: '', project: '', version: '', environment: 'Production', docNumber: '', deployType: '정기 배포', start: '', end: '', deployer: '', approver: '', date: todStr, target: '', summary: '' },
      cats: [],
      cases: [],
    },
  };
}
