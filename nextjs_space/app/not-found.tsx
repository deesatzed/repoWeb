import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Home, Github } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-slate-900 to-cyan-900 flex items-center justify-center px-6">
      <div className="text-center">
        <Github className="w-24 h-24 text-purple-400 mx-auto mb-6" />
        <h1 className="text-6xl font-bold text-white mb-4">404</h1>
        <p className="text-2xl text-slate-300 mb-8">Portfolio Not Found</p>
        <p className="text-slate-400 mb-8 max-w-md mx-auto">
          The portfolio you're looking for doesn't exist or hasn't been set up yet.
        </p>
        <Link href="/">
          <Button className="bg-gradient-to-r from-purple-500 to-cyan-500 hover:from-purple-600 hover:to-cyan-600">
            <Home className="w-4 h-4 mr-2" />
            Go Home
          </Button>
        </Link>
      </div>
    </div>
  );
}
