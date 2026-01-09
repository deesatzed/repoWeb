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
      className={`bg-slate-800/50 backdrop-blur-sm border-slate-700 p-6 h-full hover:border-blue-600/50 transition-all ${
        featured ? 'border-blue-600/30' : ''
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
              <Badge className="bg-blue-600/20 text-blue-300 border-blue-600/50 flex-shrink-0">
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

        {/* AI Analysis - Accomplishment Focused */}
        {hasAnalysis && (
          <div className="flex-1 space-y-4">
            {/* Project Type Badge */}
            {repository?.aiAnalysis?.projectType && (
              <Badge variant="outline" className="border-blue-500/50 text-blue-300">
                {repository.aiAnalysis.projectType}
              </Badge>
            )}

            {/* Summary - What it does */}
            {repository?.aiAnalysis?.summary && (
              <p className="text-sm text-slate-300 leading-relaxed">
                {repository.aiAnalysis.summary}
              </p>
            )}

            {/* Tech Stack - Prominent */}
            {repository?.aiAnalysis?.techStack?.length > 0 && (
              <div>
                <p className="text-xs text-slate-500 mb-2 font-medium">Built With</p>
                <div className="flex flex-wrap gap-1.5">
                  {repository.aiAnalysis.techStack.map((tech: string, idx: number) => (
                    <Badge 
                      key={idx} 
                      className="bg-blue-600/20 text-blue-200 border-blue-600/30 text-xs"
                    >
                      {tech}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Skills Demonstrated */}
            {repository?.aiAnalysis?.skillsDemonstrated?.length > 0 && (
              <div>
                <p className="text-xs text-slate-500 mb-2 font-medium">Skills Demonstrated</p>
                <div className="flex flex-wrap gap-1.5">
                  {repository.aiAnalysis.skillsDemonstrated.map((skill: string, idx: number) => (
                    <Badge 
                      key={idx} 
                      variant="outline" 
                      className="border-slate-600 text-slate-300 text-xs"
                    >
                      {skill}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Key Results - Metrics & Outcomes */}
            {repository?.aiAnalysis?.keyResults?.length > 0 && (
              <div className="p-3 bg-green-500/5 rounded border border-green-500/20">
                <p className="text-xs text-green-400 font-medium mb-2">Key Results</p>
                <ul className="space-y-1">
                  {repository.aiAnalysis.keyResults.map((result: string, idx: number) => (
                    <li key={idx} className="text-sm text-slate-300 flex items-start gap-2">
                      <TrendingUp className="w-3 h-3 text-green-500 mt-0.5 flex-shrink-0" />
                      <span>{result}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Novel Approaches / Technical Highlights */}
            {repository?.aiAnalysis?.novelApproaches && (
              <div className="p-3 bg-slate-900/50 rounded border border-slate-700">
                <p className="text-xs text-blue-400 font-medium mb-1">Technical Approach</p>
                <p className="text-sm text-slate-300 leading-relaxed">
                  {repository.aiAnalysis.novelApproaches}
                </p>
              </div>
            )}

            {/* Key Features */}
            {repository?.aiAnalysis?.keyFeatures?.length > 0 && (
              <div>
                <p className="text-xs text-slate-500 mb-2 font-medium">Key Features</p>
                <ul className="space-y-1">
                  {repository.aiAnalysis.keyFeatures.slice(0, 4).map((feature: string, idx: number) => (
                    <li key={idx} className="text-sm text-slate-400 flex items-start gap-2">
                      <CheckCircle2 className="w-3 h-3 text-green-500 mt-0.5 flex-shrink-0" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
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
