'use client';

import { useMemo } from 'react';
import { Card } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { Code2, Star, GitFork, Package } from 'lucide-react';
import { motion } from 'framer-motion';

interface StatsOverviewProps {
  repositories: any[];
}

const COLORS = ['#8B5CF6', '#06B6D4', '#F59E0B', '#EC4899', '#10B981', '#F97316'];

export default function StatsOverview({ repositories }: StatsOverviewProps) {
  const stats = useMemo(() => {
    const totalRepos = repositories?.length ?? 0;
    const totalStars = repositories?.reduce((sum, repo) => sum + (repo?.stargazersCount ?? 0), 0) ?? 0;
    const totalForks = repositories?.reduce((sum, repo) => sum + (repo?.forksCount ?? 0), 0) ?? 0;
    
    // Language distribution
    const languageMap: { [key: string]: number } = {};
    repositories?.forEach((repo) => {
      if (repo?.language) {
        languageMap[repo.language] = (languageMap[repo.language] ?? 0) + 1;
      }
    });
    
    const languageData = Object.entries(languageMap)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 6);

    // AI Analysis stats
    const analyzedRepos = repositories?.filter(repo => repo?.aiAnalysis) ?? [];
    const avgComplexity = analyzedRepos?.length > 0
      ? analyzedRepos.reduce((sum, repo) => sum + (repo?.aiAnalysis?.complexityScore ?? 0), 0) / analyzedRepos.length
      : 0;
    const avgQuality = analyzedRepos?.length > 0
      ? analyzedRepos.reduce((sum, repo) => sum + (repo?.aiAnalysis?.codeQualityScore ?? 0), 0) / analyzedRepos.length
      : 0;

    // Project types
    const projectTypes: { [key: string]: number } = {};
    analyzedRepos?.forEach((repo) => {
      const type = repo?.aiAnalysis?.projectType ?? 'Other';
      projectTypes[type] = (projectTypes[type] ?? 0) + 1;
    });
    
    const projectTypeData = Object.entries(projectTypes)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);

    return {
      totalRepos,
      totalStars,
      totalForks,
      languageData,
      avgComplexity: Math.round(avgComplexity),
      avgQuality: Math.round(avgQuality),
      projectTypeData,
      analyzedCount: analyzedRepos?.length ?? 0,
    };
  }, [repositories]);

  return (
    <div className="space-y-6">
      {/* Key Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4 }}
        >
          <Card className="bg-slate-800/50 backdrop-blur-sm border-slate-700 p-6 hover:border-purple-500/50 transition-all">
            <div className="flex items-center justify-between mb-2">
              <Package className="w-8 h-8 text-purple-400" />
            </div>
            <p className="text-3xl font-bold text-white">{stats.totalRepos}</p>
            <p className="text-sm text-slate-400">Repositories</p>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4, delay: 0.1 }}
        >
          <Card className="bg-slate-800/50 backdrop-blur-sm border-slate-700 p-6 hover:border-cyan-500/50 transition-all">
            <div className="flex items-center justify-between mb-2">
              <Star className="w-8 h-8 text-cyan-400" />
            </div>
            <p className="text-3xl font-bold text-white">{stats.totalStars}</p>
            <p className="text-sm text-slate-400">Total Stars</p>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4, delay: 0.2 }}
        >
          <Card className="bg-slate-800/50 backdrop-blur-sm border-slate-700 p-6 hover:border-purple-500/50 transition-all">
            <div className="flex items-center justify-between mb-2">
              <GitFork className="w-8 h-8 text-purple-400" />
            </div>
            <p className="text-3xl font-bold text-white">{stats.totalForks}</p>
            <p className="text-sm text-slate-400">Total Forks</p>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4, delay: 0.3 }}
        >
          <Card className="bg-slate-800/50 backdrop-blur-sm border-slate-700 p-6 hover:border-cyan-500/50 transition-all">
            <div className="flex items-center justify-between mb-2">
              <Code2 className="w-8 h-8 text-cyan-400" />
            </div>
            <p className="text-3xl font-bold text-white">{stats?.languageData?.length ?? 0}</p>
            <p className="text-sm text-slate-400">Languages</p>
          </Card>
        </motion.div>
      </div>

      {/* Charts */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* Language Distribution */}
        {stats?.languageData?.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.4 }}
          >
            <Card className="bg-slate-800/50 backdrop-blur-sm border-slate-700 p-6">
              <h3 className="text-lg font-semibold text-white mb-4">Language Distribution</h3>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={stats.languageData}>
                  <XAxis 
                    dataKey="name" 
                    stroke="#94a3b8" 
                    tick={{ fontSize: 11, fill: '#94a3b8' }}
                    tickLine={false}
                  />
                  <YAxis 
                    stroke="#94a3b8" 
                    tick={{ fontSize: 11, fill: '#94a3b8' }}
                    tickLine={false}
                  />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: '#1e293b', 
                      border: '1px solid #475569',
                      borderRadius: '8px',
                      fontSize: 11
                    }}
                  />
                  <Bar dataKey="value" fill="#8B5CF6" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </Card>
          </motion.div>
        )}

        {/* AI Analysis Scores */}
        {stats.analyzedCount > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.5 }}
          >
            <Card className="bg-slate-800/50 backdrop-blur-sm border-slate-700 p-6">
              <h3 className="text-lg font-semibold text-white mb-4">AI Analysis Overview</h3>
              <div className="space-y-6">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-slate-400">Avg Complexity Score</span>
                    <span className="text-lg font-bold text-white">{stats.avgComplexity}/100</span>
                  </div>
                  <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                    <motion.div
                      className="h-full bg-gradient-to-r from-purple-500 to-cyan-500"
                      initial={{ width: 0 }}
                      animate={{ width: `${stats.avgComplexity}%` }}
                      transition={{ duration: 1, delay: 0.6 }}
                    />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-slate-400">Avg Code Quality Score</span>
                    <span className="text-lg font-bold text-white">{stats.avgQuality}/100</span>
                  </div>
                  <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                    <motion.div
                      className="h-full bg-gradient-to-r from-cyan-500 to-purple-500"
                      initial={{ width: 0 }}
                      animate={{ width: `${stats.avgQuality}%` }}
                      transition={{ duration: 1, delay: 0.7 }}
                    />
                  </div>
                </div>

                <div className="pt-2">
                  <p className="text-sm text-slate-400 mb-2">Projects Analyzed</p>
                  <p className="text-2xl font-bold text-white">
                    {stats.analyzedCount} / {stats.totalRepos}
                  </p>
                </div>
              </div>
            </Card>
          </motion.div>
        )}
      </div>

      {/* Project Types */}
      {stats?.projectTypeData?.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.6 }}
        >
          <Card className="bg-slate-800/50 backdrop-blur-sm border-slate-700 p-6">
            <h3 className="text-lg font-semibold text-white mb-4">Project Types</h3>
            <div className="flex flex-wrap gap-3">
              {stats.projectTypeData.map((type, index) => (
                <motion.div
                  key={type.name}
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.4, delay: 0.7 + index * 0.1 }}
                  className="px-4 py-2 rounded-lg bg-slate-700/50 border border-slate-600"
                >
                  <p className="text-sm text-slate-300">{type.name}</p>
                  <p className="text-lg font-bold text-white">{type.value}</p>
                </motion.div>
              ))}
            </div>
          </Card>
        </motion.div>
      )}
    </div>
  );
}
