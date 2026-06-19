import { Button } from "@/components/ui/button";

export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-slate-950 to-slate-900">
      <div className="text-center space-y-6 p-8">
        <h1 className="text-5xl md:text-7xl font-bold bg-gradient-to-r from-amber-400 via-orange-500 to-red-500 bg-clip-text text-transparent">
          CryptoFlip
        </h1>
        <p className="text-xl text-slate-300 max-w-2xl">
          Provably Fair Crypto Coin Flip. Bet solo or with your squad. 
          Instant payouts. Full transparency.
        </p>
        <div className="flex gap-4 justify-center pt-4">
          <Button size="lg" className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold">
            Play Now
          </Button>
          <Button size="lg" variant="outline" className="border-slate-600 text-slate-300 hover:bg-slate-800">
            How It Works
          </Button>
        </div>
        <div className="pt-12 grid grid-cols-3 gap-8 text-slate-400 text-sm">
          <div className="space-y-2">
            <div className="text-2xl font-bold text-amber-400">98%</div>
            <div>RTP (Return to Player)</div>
          </div>
          <div className="space-y-2">
            <div className="text-2xl font-bold text-amber-400">0.001s</div>
            <div>Settlement Speed</div>
          </div>
          <div className="space-y-2">
            <div className="text-2xl font-bold text-amber-400">SHA-256</div>
            <div>Provably Fair</div>
          </div>
        </div>
      </div>
      <footer className="absolute bottom-4 text-slate-500 text-sm">
        Phase 1 — Foundation • CryptoFlip v1.0.0
      </footer>
    </main>
  );
}
