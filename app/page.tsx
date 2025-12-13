"use client";

import FerrofluidVisualizer from "@/components/visualizer/FerrofluidVisualizer";
import { SettingsPanel } from "@/components/controls/SettingsPanel";
import { AzureConnectionTest } from "@/components/controls/AzureConnectionTest";

export default function Home() {
  return (
    <main className="min-h-screen bg-black overflow-hidden relative">
      <FerrofluidVisualizer />
      <SettingsPanel />
      {process.env.NODE_ENV === "development" && <AzureConnectionTest />}
    </main>
  );
}
