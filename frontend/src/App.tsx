import { useEffect, useState } from 'react';
import { Toaster } from './components/ui/sonner';
import Sidebar, { type TabKey } from './components/Sidebar';
import Header from './components/Header';
import CommandPalette from './components/CommandPalette';
import CaseManagerPage from './pages/CaseManagerPage';
import ReportPage from './pages/ReportPage';
import AutoRunPage from './pages/AutoRunPage';
import HistoryPage from './pages/HistoryPage';
import AnalyticsPage from './pages/AnalyticsPage';
import CaseHistoryPage from './pages/CaseHistoryPage';
import DashboardPage from './pages/DashboardPage';
import SuitePage from './pages/SuitePage';
import NotificationsPage from './pages/NotificationsPage';
import PresetsPage from './pages/PresetsPage';
import ExcelImportModal from './components/ExcelImportModal';
import AnalysisModal from './components/AnalysisModal';
import { useQAStore } from './store/useQAStore';
import { listProjects } from './api/projects';
import type { Project } from './types/qa';

function App() {
  const [tab, setTab] = useState<TabKey>('mgr');
  const [showExcel, setShowExcel] = useState(false);
  const [showAnalysis, setShowAnalysis] = useState(false);
  const [showDashboard, setShowDashboard] = useState(true);
  const [projects, setProjects] = useState<Project[]>([]);
  const [focusCase, setFocusCase] = useState<{ tree: 'tst' | 'dep'; id: string; nonce: number } | null>(null);
  const projectId = useQAStore((s) => s.projectId);
  const loadProject = useQAStore((s) => s.loadProject);
  const setProjectId = useQAStore((s) => s.setProjectId);
  const data = useQAStore((s) => s.data);

  useEffect(() => {
    if (projectId) loadProject(projectId);
  }, [projectId]);

  useEffect(() => {
    listProjects().then(setProjects);
  }, [projectId]);

  const projectName = projects.find((p) => p.id === projectId)?.name ?? null;

  return (
    <div className="flex h-screen bg-background">
      <Sidebar
        tab={tab}
        onTabChange={(t) => { setShowDashboard(false); setTab(t); }}
        projectId={projectId}
        onProjectChange={(id) => { setShowDashboard(false); setProjectId(id); }}
        onOpenExcelImport={() => setShowExcel(true)}
        onOpenAnalysis={() => setShowAnalysis(true)}
        onSelectCase={(treeTab, id) => { setShowDashboard(false); setTab(treeTab); setFocusCase({ tree: treeTab, id, nonce: Date.now() }); }}
        onOpenDashboard={() => setShowDashboard(true)}
        data={data}
      />
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <Header projectName={showDashboard ? '전체 대시보드' : projectName} />
        <div className="min-h-0 flex-1">
          {showDashboard ? (
            <DashboardPage onSelectProject={(id) => { setProjectId(id); setShowDashboard(false); setTab('history'); }} />
          ) : !projectId ? (
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
              프로젝트를 선택하거나 새로 생성해주세요
            </div>
          ) : (
            <>
              {tab === 'suites' && <SuitePage />}
              {tab === 'mgr' && <CaseManagerPage />}
              {tab === 'auto' && <AutoRunPage onGoHistory={() => setTab('history')} />}
              {tab === 'history' && <HistoryPage />}
              {tab === 'analytics' && <AnalyticsPage />}
              {tab === 'case-history' && <CaseHistoryPage />}
              {tab === 'notifications' && <NotificationsPage />}
              {tab === 'presets' && <PresetsPage />}
              {tab === 'tst' && (
                <ReportPage
                  mode="tst"
                  projectName={projectName}
                  focusCase={focusCase?.tree === 'tst' ? focusCase : null}
                />
              )}
              {tab === 'dep' && (
                <ReportPage
                  mode="dep"
                  projectName={projectName}
                  focusCase={focusCase?.tree === 'dep' ? focusCase : null}
                />
              )}
            </>
          )}
        </div>
      </div>
      {showExcel && (
        <ExcelImportModal
          onClose={() => setShowExcel(false)}
          onImported={() => setTab('mgr')}
        />
      )}
      {showAnalysis && projectId && <AnalysisModal projectId={projectId} onClose={() => setShowAnalysis(false)} />}
      <CommandPalette projects={projects} onSelectProject={setProjectId} onSelectTab={setTab} />
      <Toaster />
    </div>
  );
}

export default App;
