import BottomNav from './BottomNav';

export default function Layout({ children }) {
  return (
    <div className="min-h-screen min-h-dvh bg-[#0a0a0a] flex flex-col max-w-lg mx-auto">
      <main className="flex-1 overflow-y-auto pb-20">
        {children}
      </main>
      <BottomNav />
    </div>
  );
}
