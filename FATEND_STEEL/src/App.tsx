import React, { useState } from 'react';
import { AppProvider, useApp } from './context/AppContext';
import { Navbar, NavTab } from './components/Navbar';
import { PinLoginModal } from './components/PinLoginModal';
import { ProjectView } from './components/ProjectView';
import { StockView } from './components/StockView';
import { ScanReceiptView } from './components/ScanReceiptView';
import { WagesAndKasbonView } from './components/WagesAndKasbonView';
import { CashflowView } from './components/CashflowView';
import { PrintReportView } from './components/PrintReportView';
import { DailyCashView } from './components/DailyCashView';
import { Lock } from 'lucide-react';

const MainAppContent: React.FC = () => {
  const { session } = useApp();
  const [currentTab, setCurrentTab] = useState<NavTab>('projects');
  const [scanInitialProjectId, setScanInitialProjectId] = useState<string | undefined>();
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);

  const isPemilik = session?.role === 'PEMILIK';
  const isLockedTab = !isPemilik && (currentTab === 'wages' || currentTab === 'cashflow' || currentTab === 'report');

  const handleOpenScanForProject = (projectId: string) => {
    setScanInitialProjectId(projectId);
    setCurrentTab('scan');
  };

  const handleNavigateToProject = (projectId: string) => {
    setSelectedProjectId(projectId);
    setCurrentTab('projects');
  };

  return (
    <div className="min-h-dvh bg-[#0e1013] text-zinc-100 flex flex-col selection:bg-amber-500 selection:text-black">
      {/* PIN Login Screen Modal if not logged in */}
      <PinLoginModal />

      {/* Top Navbar & Mobile Bottom Navigation */}
      <Navbar currentTab={currentTab} onSelectTab={setCurrentTab} />

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-3 sm:p-6 pb-28 md:pb-6">
        {isLockedTab ? (
          <div className="p-8 sm:p-12 text-center bg-[#16181e] rounded-2xl border border-zinc-800 max-w-lg mx-auto my-8">
            <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-400 flex items-center justify-center mx-auto mb-4">
              <Lock className="w-7 h-7" />
            </div>
            <h3 className="font-industrial text-xl font-bold text-white mb-2">
              Akses Terkunci 🔒
            </h3>
            <p className="text-xs text-zinc-400 leading-relaxed mb-6">
              Menu ini memuat data keuangan, kasbon, dan omzet internal yang hanya dapat diakses oleh Pemilik Bengkel. Anda saat ini masuk sebagai <strong>Admin / Kasir</strong>.
            </p>
            <button
              type="button"
              onClick={() => setCurrentTab('projects')}
              className="py-2.5 px-6 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-bold text-xs shadow-md transition-all active:scale-95"
            >
              Kembali ke Proyek Bengkel
            </button>
          </div>
        ) : (
          <>
            {currentTab === 'projects' && (
              <ProjectView
                initialSelectedProjectId={selectedProjectId}
                onOpenScanForProject={handleOpenScanForProject}
              />
            )}
            {currentTab === 'inventory' && <StockView />}
            {currentTab === 'scan' && (
              <ScanReceiptView
                initialProjectId={scanInitialProjectId}
                onNavigateToProjects={handleNavigateToProject}
              />
            )}
            {currentTab === 'dailycash' && <DailyCashView />}
            {currentTab === 'wages' && isPemilik && <WagesAndKasbonView />}
            {currentTab === 'cashflow' && isPemilik && <CashflowView />}
            {currentTab === 'report' && isPemilik && <PrintReportView />}
          </>
        )}
      </main>

      {/* Footer Industrial Brand (Hidden when printing) */}
      <footer className="no-print border-t border-zinc-800/80 bg-[#121316] py-3 text-center text-xs text-zinc-500 font-mono">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-1">
          <span>CV FATEND STEEL • Fabrikasi & Konstruksi Las Logam</span>
          <span className="text-[11px] text-zinc-400">
            Sistem Operasional Bengkel & Scan Nota AI
          </span>
        </div>
      </footer>
    </div>
  );
};

export default function App() {
  return (
    <AppProvider>
      <MainAppContent />
    </AppProvider>
  );
}
