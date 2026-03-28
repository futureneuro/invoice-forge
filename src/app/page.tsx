'use client';

import React from 'react';
import { Toaster } from 'react-hot-toast';
import { Sidebar } from '@/components/layout/Sidebar';
import { DashboardView } from '@/components/views/DashboardView';
import { ProjectsView } from '@/components/views/ProjectsView';
import { InvoiceFlowView } from '@/components/views/InvoiceFlowView';
import { SettingsView } from '@/components/views/SettingsView';
import { useNavStore } from '@/lib/store';

export default function HomePage() {
  const { currentStep } = useNavStore();

  const renderView = () => {
    switch (currentStep) {
      case 'dashboard':
        return <DashboardView />;
      case 'projects':
        return <ProjectsView />;
      case 'invoice-flow':
        return <InvoiceFlowView />;
      case 'settings':
        return <SettingsView />;
      default:
        return <DashboardView />;
    }
  };

  return (
    <div className="app-layout">
      <Sidebar />
      <main className="main-content">
        {renderView()}
      </main>
      <Toaster
        position="bottom-right"
        toastOptions={{
          className: 'toast-custom',
          duration: 3000,
        }}
      />
    </div>
  );
}
