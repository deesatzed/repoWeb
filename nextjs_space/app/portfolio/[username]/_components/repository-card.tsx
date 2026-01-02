'use client';

import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Code2,
  Sparkles,
  TrendingUp,
  CheckCircle2,
  FileText,
  TestTube,
} from 'lucide-react';
import { motion } from 'framer-motion';

interface RepositoryCardProps {
  repository: any;
  featured?: boolean;
}

export default function RepositoryCard({ repository, featured = false }: RepositoryCardProps) {
  const hasAnalysis = repository?.aiAnalysis;

  return (
    <Card 
      className={`bg-slate-800/50 backdrop-blur-sm border-slate-700 p-6 h-full hover:border-purple-500/50 transition-all ${
        featured ? 'border-purple-500/30' : ''
      }`}
    >
      <div className="flex flex-col h-full">
        {/* Header */}
        <div className="mb-4">
          <div className="flex items-start justify-between gap-2 mb-2">
            <div className="flex-1 min-w-0">
              <h3 className="text-xl font-semibold text-white">
                {repository?.name}
              </h3>
            </div>
            {featured && (
              <Badge className="bg-purple-500/20 text-purple-300 border-purple-500/50 flex-shrink-0">
                <TrendingUp className="w-3 h-3 mr-1" />
                Featured
              </Badge>
            )}
          </div>

          {repository?.description && (
            <p className="text-slate-400 text-sm line-clamp-2 mb-3">
              {repository.description}
            </p>
          )}

          {/* Tech Info */}
          <div className="flex items-center gap-3 text-sm text-slate-400">
            {repository?.language && (
              <div className="flex items-center gap-1">
                <Code2 className="w-4 h-4" />
                <span>{repository.language}</span>
              </div>
            )}
            {repository?.aiAnalysis?.hasTests && (
              <div className="flex items-center gap-1 text-green-400">
                <TestTube className="w-4 h-4" />
                <span>Tests</span>
              </div>
            )}
            {repository?.aiAnalysis?.hasDocumentation && (
              <div className="flex items-center gap-1 text-blue-400">
                <FileText className="w-4 h-4" />
                <span>Docs</span>
              </div>
            )}
          </div>
        </div>

        {/* AI Analysis - Skills Focused */}
        {hasAnalysis && (
          <div className="flex-1 space-y-4">
            <div className="p-4 rounded-lg bg-purple-500/5 border border-purple-500/20">
              <div className="flex items-center gap-2 mb-2">
                <Sparkles className="w-4 h-4 text-purple-400" />
                <span className="text-sm font-semibold text-purple-300">Technical Capabilities</span>
              </div>

              {/* Technical Sophistication Indicators */}
              <div className="grid grid-cols-2 gap-3 mb-4">
                {repository?.aiAnalysis?.complexityScore !== undefined && (
                  <div>
                    <p className="text-xs text-slate-500 mb-1">Technical Depth</p>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-1.5 bg-slate-700 rounded-full overflow-hidden">
                        <motion.div
                          className="h-full bg-gradient-to-r from-purple-500 to-cyan-500"
                          initial={{ width: 0 }}
                          whileInView={{ width: `${repository.aiAnalysis.complexityScore}%` }}
                          viewport={{ once: true }}
                          transition={{ duration: 0.8 }}
                        />
                      </div>
                      <span className="text-sm font-semibold text-white">
                        {repository.aiAnalysis.complexityScore}
                      </span>
                    </div>
                  </div>
                )}

                {repository?.aiAnalysis?.codeQualityScore !== undefined && (
                  <div>
                    <p className="text-xs text-slate-500 mb-1">Engineering Practices</p>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-1.5 bg-slate-700 rounded-full overflow-hidden">
                        <motion.div
                          className="h-full bg-gradient-to-r from-cyan-500 to-purple-500"
                          initial={{ width: 0 }}
                          whileInView={{ width: `${repository.aiAnalysis.codeQualityScore}%` }}
                          viewport={{ once: true }}
                          transition={{ duration: 0.8, delay: 0.1 }}
                        />
                      </div>
                      <span className="text-sm font-semibold text-white">
                        {repository.aiAnalysis.codeQualityScore}
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* Key Features - Detailed */}
              {repository?.aiAnalysis?.keyFeatures?.length > 0 && (
                <div className="mb-4 space-y-2">
                  <p className="text-xs text-slate-500 font-medium">Key Features</p>
                  <ul className="space-y-1">
                    {repository.aiAnalysis.keyFeatures.slice(0, 4).map((feature: string, idx: number) => (
                      <li key={idx} className="text-sm text-slate-300 flex items-start gap-2">
                        <span className="w-1 h-1 rounded-full bg-cyan-500 mt-2 flex-shrink-0" />
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* What This Demonstrates - KEY SECTION */}
              {repository?.aiAnalysis?.employerHighlights && (
                <div className="mb-3 p-3 bg-slate-900/50 rounded border border-slate-700">
                  <p className="text-xs text-purple-400 font-semibold mb-1 flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" />
                    Skills Demonstrated:
                  </p>
                  <p className="text-sm text-slate-200 leading-relaxed">
                    {repository.aiAnalysis.employerHighlights}
                  </p>
                </div>
              )}

              {/* Technical Skills */}
              {repository?.aiAnalysis?.skillsDemonstrated?.length > 0 && (
                <div className="mb-3">
                  <p className="text-xs text-slate-500 mb-2">Technical Competencies:</p>
                  <div className="flex flex-wrap gap-1.5">
                    {repository.aiAnalysis.skillsDemonstrated.map((skill: string, idx: number) => (
                      <Badge 
                        key={idx} 
                        variant="secondary" 
                        className="bg-purple-500/10 text-purple-200 border-purple-500/20 text-xs"
                      >
                        {skill}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* Architecture */}
              {repository?.aiAnalysis?.architecturePatterns?.length > 0 && (
                <div>
                  <p className="text-xs text-slate-500 mb-2">Design Patterns Used:</p>
                  <div className="flex flex-wrap gap-1.5">
                    {repository.aiAnalysis.architecturePatterns.map((pattern: string, idx: number) => (
                      <Badge 
                        key={idx} 
                        variant="outline" 
                        className="border-cyan-500/30 text-cyan-300 text-xs"
                      >
                        {pattern}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Tech Stack */}
            {repository?.aiAnalysis?.techStack?.length > 0 && (
              <div>
                <p className="text-xs text-slate-500 mb-2">Technology Stack:</p>
                <div className="flex flex-wrap gap-1.5">
                  {repository.aiAnalysis.techStack.slice(0, 6).map((tech: string, idx: number) => (
                    <Badge 
                      key={idx} 
                      variant="outline" 
                      className="border-slate-600 text-slate-300 text-xs"
                    >
                      {tech}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {!hasAnalysis && (
          <div className="flex-1 flex items-center justify-center text-slate-500 text-sm">
            Analysis pending
          </div>
        )}
      </div>
    </Card>
  );
}
