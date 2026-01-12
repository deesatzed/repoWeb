'use client';

import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Code2,
  Sparkles,
  TrendingUp,
  CheckCircle2,
  FileText,
  TestTube,
  ChevronDown,
  ChevronUp,
  Download,
  Lock,
  Copy,
} from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';

interface RepositoryCardProps {
  repository: any;
  featured?: boolean;
}

export default function RepositoryCard({ repository, featured = false }: RepositoryCardProps) {
  const hasAnalysis = repository?.aiAnalysis;
  const title = repository?.displayName || repository?.aiAnalysis?.displayTitle || repository?.name;
  const [expanded, setExpanded] = useState(Boolean(featured));

  const techStack: string[] = Array.isArray(repository?.aiAnalysis?.techStack) ? repository.aiAnalysis.techStack : [];
  const keyFeatures: string[] = Array.isArray(repository?.aiAnalysis?.keyFeatures) ? repository.aiAnalysis.keyFeatures : [];
  const skills: string[] = Array.isArray(repository?.aiAnalysis?.skillsDemonstrated) ? repository.aiAnalysis.skillsDemonstrated : [];
  const keyResults: string[] = Array.isArray(repository?.aiAnalysis?.keyResults) ? repository.aiAnalysis.keyResults : [];
  const architecturePatterns: string[] = Array.isArray(repository?.aiAnalysis?.architecturePatterns) ? repository.aiAnalysis.architecturePatterns : [];
  const strengths: string[] = Array.isArray(repository?.aiAnalysis?.strengths) ? repository.aiAnalysis.strengths : [];

  const collapsedTechStack = techStack.slice(0, 6);
  const collapsedKeyFeatures = keyFeatures.slice(0, 2);
  const collapsedSkills = skills.slice(0, 4);

  const canExpand = Boolean(
    (techStack.length > collapsedTechStack.length) ||
      (keyFeatures.length > collapsedKeyFeatures.length) ||
      (skills.length > collapsedSkills.length) ||
      (keyResults.length > 0) ||
      (repository?.aiAnalysis?.novelApproaches) ||
      (architecturePatterns.length > 0) ||
      (repository?.aiAnalysis?.employerHighlights) ||
      (strengths.length > 0)
  );

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
                {title}
              </h3>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              {repository?.whitepaper && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    const whitepaper = repository.whitepaper;
                    const content = `
# ${whitepaper.title}

## Abstract
${whitepaper.abstract}

${whitepaper.sections.map((section: any) => `
## ${section.heading}
${section.content}
${section.subsections?.map((sub: any) => `
### ${sub.heading}
${sub.content}
`).join('') || ''}
`).join('\n')}

## Technical Specifications

### Architecture
${whitepaper.technicalSpecs.architecture}

### Design Patterns
${whitepaper.technicalSpecs.designPatterns.map((p: string) => `- ${p}`).join('\n')}

### Key Algorithms
${whitepaper.technicalSpecs.keyAlgorithms.map((a: string) => `- ${a}`).join('\n')}

### Data Structures
${whitepaper.technicalSpecs.dataStructures.map((d: string) => `- ${d}`).join('\n')}
${whitepaper.technicalSpecs.performanceCharacteristics ? `
### Performance Characteristics
${whitepaper.technicalSpecs.performanceCharacteristics}
` : ''}
${whitepaper.technicalSpecs.securityConsiderations ? `
### Security Considerations
${whitepaper.technicalSpecs.securityConsiderations}
` : ''}
${whitepaper.technicalSpecs.scalabilityApproach ? `
### Scalability Approach
${whitepaper.technicalSpecs.scalabilityApproach}
` : ''}

## Implementation Notes
${whitepaper.implementationNotes.map((note: any) => `
### ${note.topic}
${note.details}
${note.codeReferences.length ? `
Code References:
${note.codeReferences.map((ref: string) => `- \`${ref}\``).join('\n')}
` : ''}
`).join('\n')}

## Design Tradeoffs
${whitepaper.tradeoffs.map((tradeoff: any) => `
### ${tradeoff.decision}
**Alternatives:** ${tradeoff.alternatives.join(', ')}
**Rationale:** ${tradeoff.rationale}
`).join('\n')}

---
Generated: ${new Date(whitepaper.generatedAt).toLocaleString()}
                    `.trim();
                    const blob = new Blob([content], { type: 'text/markdown' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `${repository.name}-whitepaper.md`;
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    URL.revokeObjectURL(url);
                  }}
                  className="border-slate-600 text-slate-200 hover:bg-slate-700 h-8 px-2"
                  title="Download Public Whitepaper"
                >
                  <Download className="w-4 h-4" />
                </Button>
              )}
              {repository?.whitepaperHash && repository?.protectedWhitepaper && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    const hash = repository.whitepaperHash;
                    const url = `${window.location.origin}/api/whitepaper/protected/${hash}`;
                    navigator.clipboard.writeText(url);
                    alert('Protected whitepaper URL copied to clipboard!\n\nShare this URL with recruiters or employers for full access.');
                  }}
                  className="border-purple-600/50 text-purple-200 hover:bg-purple-600/10 h-8 px-2"
                  title="Copy Protected Whitepaper URL"
                >
                  <Copy className="w-4 h-4" />
                </Button>
              )}
              {repository?.whitepaperHash && repository?.protectedWhitepaper && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    const hash = repository.whitepaperHash;
                    window.open(`/api/whitepaper/protected/${hash}`, '_blank');
                  }}
                  className="border-purple-600/50 text-purple-200 hover:bg-purple-600/10 h-8 px-2"
                  title="View Protected Whitepaper"
                >
                  <Lock className="w-4 h-4" />
                </Button>
              )}
              {featured && (
                <Badge className="bg-blue-600/20 text-blue-300 border-blue-600/50">
                  <TrendingUp className="w-3 h-3 mr-1" />
                  Featured
                </Badge>
              )}
            </div>
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
              <p className={`text-sm text-slate-300 leading-relaxed ${expanded ? '' : 'line-clamp-3'}`}>
                {repository.aiAnalysis.summary}
              </p>
            )}

            {/* Tech Stack - Prominent */}
            {techStack.length > 0 && (
              <div>
                <p className="text-xs text-slate-500 mb-2 font-medium">Built With</p>
                <div className="flex flex-wrap gap-1.5">
                  {(expanded ? techStack : collapsedTechStack).map((tech: string, idx: number) => (
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
            {skills.length > 0 && (
              <div>
                <p className="text-xs text-slate-500 mb-2 font-medium">Skills Demonstrated</p>
                <div className="flex flex-wrap gap-1.5">
                  {(expanded ? skills : collapsedSkills).map((skill: string, idx: number) => (
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

            {/* Key Features */}
            {keyFeatures.length > 0 && (
              <div>
                <p className="text-xs text-slate-500 mb-2 font-medium">Key Features</p>
                <ul className="space-y-1">
                  {(expanded ? keyFeatures.slice(0, 8) : collapsedKeyFeatures).map((feature: string, idx: number) => (
                    <li key={idx} className="text-sm text-slate-400 flex items-start gap-2">
                      <CheckCircle2 className="w-3 h-3 text-green-500 mt-0.5 flex-shrink-0" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <AnimatePresence initial={false}>
              {expanded && (
                <motion.div
                  key="expanded"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.2 }}
                  className="space-y-4 overflow-hidden"
                >
                  {keyResults.length > 0 && (
                    <div className="p-3 bg-green-500/5 rounded border border-green-500/20">
                      <p className="text-xs text-green-400 font-medium mb-2">Key Results</p>
                      <ul className="space-y-1">
                        {keyResults.slice(0, 6).map((result: string, idx: number) => (
                          <li key={idx} className="text-sm text-slate-300 flex items-start gap-2">
                            <TrendingUp className="w-3 h-3 text-green-500 mt-0.5 flex-shrink-0" />
                            <span>{result}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {repository?.aiAnalysis?.novelApproaches && (
                    <div className="p-3 bg-slate-900/50 rounded border border-slate-700">
                      <p className="text-xs text-blue-400 font-medium mb-1">Technical Approach</p>
                      <p className="text-sm text-slate-300 leading-relaxed">
                        {repository.aiAnalysis.novelApproaches}
                      </p>
                    </div>
                  )}

                  {architecturePatterns.length > 0 && (
                    <div>
                      <p className="text-xs text-slate-500 mb-2 font-medium">Architecture</p>
                      <div className="flex flex-wrap gap-1.5">
                        {architecturePatterns.slice(0, 8).map((pattern: string, idx: number) => (
                          <Badge
                            key={idx}
                            variant="outline"
                            className="border-blue-600/30 text-blue-200 text-xs"
                          >
                            {pattern}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  {repository?.aiAnalysis?.employerHighlights && (
                    <div className="p-3 bg-blue-500/5 rounded border border-blue-500/20">
                      <p className="text-xs text-blue-300 font-medium mb-1">Highlighted Repo&apos;s</p>
                      <p className="text-sm text-slate-200 leading-relaxed">
                        {repository.aiAnalysis.employerHighlights}
                      </p>
                    </div>
                  )}

                  {strengths.length > 0 && (
                    <div>
                      <p className="text-xs text-slate-500 mb-2 font-medium">Strengths</p>
                      <ul className="space-y-1">
                        {strengths.slice(0, 6).map((strength: string, idx: number) => (
                          <li key={idx} className="text-sm text-slate-400 flex items-start gap-2">
                            <Sparkles className="w-3 h-3 text-blue-500 mt-0.5 flex-shrink-0" />
                            <span>{strength}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>

            {canExpand && (
              <div className="pt-1">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setExpanded(prev => !prev)}
                  className="border-slate-600 text-slate-200 hover:bg-slate-700 w-full justify-center"
                >
                  {expanded ? (
                    <>
                      <ChevronUp className="w-4 h-4 mr-1" />
                      Show less
                    </>
                  ) : (
                    <>
                      <ChevronDown className="w-4 h-4 mr-1" />
                      Show more
                    </>
                  )}
                </Button>
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
