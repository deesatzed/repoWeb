import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Home, Github } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-900 to-slate-800 flex items-center justify-center px-6">
      <div className="text-center">
        <Github className="w-24 h-24 text-blue-500 mx-auto mb-6" />
        <h1 className="text-6xl font-bold text-white mb-4">404</h1>
        <p className="text-2xl text-slate-300 mb-8">Portfolio Not Found</p>
        <p className="text-slate-400 mb-8 max-w-md mx-auto">
          The portfolio you're looking for doesn't exist or hasn't been set up yet.
        </p>
        <Link href="/">
          <Button className="bg-blue-600 hover:bg-blue-700">
            <Home className="w-4 h-4 mr-2" />
            Go Home
          </Button>
        </Link>
      </div>
    </div>
  );
}
