import FerrofluidVisualizer from "@/components/FerrofluidVisualizer";

export default function Home() {
  return (
    <main className="min-h-screen bg-black">
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-4xl font-bold text-white mb-4 text-center">
          Ferrofluid Visualizer
        </h1>
        <p className="text-gray-400 text-center mb-8">
          磁性流体の3Dビジュアライゼーション
        </p>
        <FerrofluidVisualizer />
      </div>
    </main>
  );
}
