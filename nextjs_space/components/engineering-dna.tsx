
'use client';

import { useEffect, useState } from 'react';
import { 
  ScatterChart, 
  Scatter, 
  XAxis, 
  YAxis, 
  ZAxis, 
  Tooltip, 
  ResponsiveContainer, 
  CartesianGrid,
  Cell
} from 'recharts';
import { motion } from 'framer-motion';
import { Brain, Sparkles, AlertCircle, Loader2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';

interface CodeAsset {
  id: string;
  name: string;
  type: string; // 'function' | 'class'
  language: string;
  complexity: number;
  frequency: number;
  valueScore: number;
  occurrences: Array<{ repoName: string; filePath: string }>;
}

interface EngineeringDNAProps {
  username: string;
}

export default function EngineeringDNA({ username }: EngineeringDNAProps) {
  const [assets, setAssets] = useState<CodeAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function fetchDNA() {
      try {
        const res = await fetch(`/api/portfolio/${username}/dna`);
        if (!res.ok) throw new Error('Failed to fetch DNA');
        const data = await res.json();
        setAssets(data.assets || []);
      } catch (err) {
        console.error(err);
        setError('Could not load engineering DNA');
      } finally {
        setLoading(false);
      }
    }
    fetchDNA();
  }, [username]);

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12 text-slate-400">
        <Loader2 className="w-6 h-6 animate-spin mr-2" />
        Analyzing Codebase DNA...
      </div>
    );
  }

  if (error || assets.length === 0) {
    return null; // Hide section if no data
  }

  // Prepare Chart Data
  // We want to highlight the "Diamonds" (High Value)
  // X: Frequency (Inverted or Log? Plain is fine, lower is better)
  // Y: Complexity
  const chartData = assets.map(asset => ({
    ...asset,
    // Add jitter to avoid overlapping points
    x: asset.frequency + (Math.random() * 0.2 - 0.1),
    y: asset.complexity + (Math.random() * 0.2 - 0.1),
    z: asset.valueScore
  }));

  const topDiamonds = [...assets].sort((a, b) => b.valueScore - a.valueScore).slice(0, 5);

  return (
    <section className="py-12 px-6">
      <div className="max-w-7xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <div className="flex items-center gap-3 mb-8">
            <Brain className="w-7 h-7 text-pink-400" />
            <h2 className="text-4xl font-bold text-white">Engineering DNA</h2>
          </div>
          
          <p className="text-slate-300 mb-8 text-lg">
            A deep-dive analysis of the codebase revealing unique algorithmic complexity and proprietary logic patterns.
          </p>

          <div className="grid lg:grid-cols-3 gap-8">
            
            {/* Chart Section */}
            <Card className="lg:col-span-2 bg-slate-800/50 backdrop-blur-lg border-slate-700">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-yellow-400" />
                  Complexity vs. Scarcity
                </CardTitle>
                <CardDescription className="text-slate-400">
                  Identifying "Diamonds" in the code: High complexity assets that appear infrequently (custom logic).
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[400px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                      <XAxis 
                        type="number" 
                        dataKey="x" 
                        name="Frequency" 
                        stroke="#94a3b8"
                        label={{ value: 'Frequency (Lower is rarer)', position: 'bottom', fill: '#94a3b8', offset: 0 }}
                      />
                      <YAxis 
                        type="number" 
                        dataKey="y" 
                        name="Complexity" 
                        stroke="#94a3b8"
                        label={{ value: 'Complexity Score', angle: -90, position: 'left', fill: '#94a3b8' }}
                      />
                      <ZAxis type="number" dataKey="z" range={[50, 400]} />
                      <Tooltip 
                        cursor={{ strokeDasharray: '3 3' }}
                        content={({ active, payload }) => {
                          if (active && payload && payload.length) {
                            const data = payload[0].payload;
                            return (
                              <div className="bg-slate-900 border border-slate-700 p-3 rounded-lg shadow-xl">
                                <p className="font-bold text-pink-300 mb-1">{data.name}</p>
                                <p className="text-xs text-slate-400 font-mono mb-2">{data.type}</p>
                                <div className="text-sm text-slate-300 space-y-1">
                                  <div className="flex justify-between gap-4">
                                    <span>Complexity:</span>
                                    <span className="font-mono text-white">{data.complexity}</span>
                                  </div>
                                  <div className="flex justify-between gap-4">
                                    <span>Occurrences:</span>
                                    <span className="font-mono text-white">{data.frequency}</span>
                                  </div>
                                  <div className="flex justify-between gap-4 pt-1 border-t border-slate-800 mt-1">
                                    <span className="text-yellow-400">Value Score:</span>
                                    <span className="font-mono text-yellow-400">{data.valueScore.toFixed(1)}</span>
                                  </div>
                                </div>
                              </div>
                            );
                          }
                          return null;
                        }}
                      />
                      <Scatter name="Assets" data={chartData} fill="#8884d8">
                        {chartData.map((entry, index) => (
                          <Cell 
                            key={`cell-${index}`} 
                            fill={entry.valueScore > 50 ? '#f472b6' : '#60a5fa'} 
                            fillOpacity={entry.valueScore > 50 ? 0.9 : 0.6}
                          />
                        ))}
                      </Scatter>
                    </ScatterChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* Top Diamonds List */}
            <Card className="bg-slate-800/50 backdrop-blur-lg border-slate-700 h-full">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <AlertCircle className="w-5 h-5 text-pink-400" />
                  Top "Diamonds" Found
                </CardTitle>
                <CardDescription className="text-slate-400">
                  Highest value-add proprietary logic.
                </CardDescription>
              </CardHeader>
              <CardContent className="h-[400px]">
                <ScrollArea className="h-full pr-4">
                  <div className="space-y-4">
                    {topDiamonds.map((asset) => (
                      <div 
                        key={asset.id} 
                        className="p-3 rounded-lg bg-slate-900/50 border border-slate-700 hover:border-pink-500/50 transition-colors group"
                      >
                        <div className="flex justify-between items-start mb-1">
                          <h4 className="font-mono text-sm font-semibold text-pink-300 truncate w-full group-hover:text-pink-200">
                            {asset.name}
                          </h4>
                          <Badge variant="outline" className="ml-2 border-pink-500/30 text-pink-400 text-[10px] whitespace-nowrap">
                            Score: {asset.valueScore.toFixed(0)}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-slate-500 mb-2">
                          <Badge variant="secondary" className="bg-slate-800 text-slate-400 text-[10px] hover:bg-slate-700">
                            {asset.type}
                          </Badge>
                          <span>Complexity: {asset.complexity}</span>
                        </div>
                        <div className="text-xs text-slate-400 truncate">
                          in <span className="text-cyan-400">{asset.occurrences[0]?.repoName}</span>
                          <span className="text-slate-600 mx-1">/</span>
                          {asset.occurrences[0]?.filePath.split('/').pop()}
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>

          </div>
        </motion.div>
      </div>
    </section>
  );
}
