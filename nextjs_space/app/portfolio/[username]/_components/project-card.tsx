'use client';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { FolderOpen, Code2, TestTube, Lightbulb, Target } from 'lucide-react';

interface ProjectAnalysis {
  technicalSkills: string[];
  designDecisions: string | null;
  novelApproaches: string | null;
  testingStrategy: string | null;
  problemsSolved: string | null;
  skillDemonstration: string | null;
  architectureInsights: string | null;
  techStack: string[];
}

interface Repository {
  id: string;
  name: string;
  description: string | null;
  language: string | null;
}

interface Project {
  id: string;
  name: string;
  description: string | null;
  repositories: Repository[];
  aiAnalysis: ProjectAnalysis | null;
}

interface ProjectCardProps {
  project: Project;
}

export default function ProjectCard({ project }: ProjectCardProps) {
  const analysis = project.aiAnalysis;

  return (
    <Card className="bg-slate-800/50 backdrop-blur-sm border-slate-700 hover:border-blue-600/50 transition-colors">
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <CardTitle className="text-white flex items-center gap-2">
              <FolderOpen className="h-5 w-5 text-blue-500" />
              {project.name}
            </CardTitle>
            {project.description && (
              <CardDescription className="mt-2 text-slate-300">
                {project.description}
              </CardDescription>
            )}
          </div>
        </div>
        <div className="flex flex-wrap gap-2 mt-3">
          <Badge variant="outline" className="text-cyan-400 border-cyan-400/50">
            {project.repositories.length} {project.repositories.length === 1 ? 'Repository' : 'Iterations'}
          </Badge>
        </div>
      </CardHeader>
      
      <CardContent>
        {analysis ? (
          <div className="space-y-4">
            {/* Technical Skills Demonstrated */}
            {analysis.technicalSkills && analysis.technicalSkills.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold text-blue-300 mb-2 flex items-center gap-2">
                  <Code2 className="h-4 w-4" />
                  Technical Skills Demonstrated
                </h4>
                <div className="flex flex-wrap gap-2">
                  {analysis.technicalSkills.map((skill, i) => (
                    <Badge key={i} variant="secondary" className="bg-blue-600/10 text-blue-200 border-blue-600/20">
                      {skill}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Tech Stack */}
            {analysis.techStack && analysis.techStack.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold text-cyan-300 mb-2">Technology Stack</h4>
                <div className="flex flex-wrap gap-2">
                  {analysis.techStack.map((tech, i) => (
                    <Badge key={i} variant="outline" className="text-cyan-200 border-cyan-500/30">
                      {tech}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Skill Demonstration (Main highlight) */}
            {analysis.skillDemonstration && (
              <div className="bg-blue-600/5 border border-blue-600/20 rounded-lg p-4">
                <h4 className="text-sm font-semibold text-blue-300 mb-2 flex items-center gap-2">
                  <Target className="h-4 w-4" />
                  What This Demonstrates
                </h4>
                <p className="text-sm text-slate-300 leading-relaxed">
                  {analysis.skillDemonstration}
                </p>
              </div>
            )}

            {/* Detailed Analysis Accordion */}
            <Accordion type="single" collapsible className="w-full">
              {analysis.designDecisions && (
                <AccordionItem value="design" className="border-slate-700">
                  <AccordionTrigger className="text-sm text-slate-200 hover:text-white">
                    Design Decisions & Architecture
                  </AccordionTrigger>
                  <AccordionContent className="text-sm text-slate-400 leading-relaxed">
                    {analysis.designDecisions}
                  </AccordionContent>
                </AccordionItem>
              )}

              {analysis.problemsSolved && (
                <AccordionItem value="problems" className="border-slate-700">
                  <AccordionTrigger className="text-sm text-slate-200 hover:text-white">
                    Technical Challenges Solved
                  </AccordionTrigger>
                  <AccordionContent className="text-sm text-slate-400 leading-relaxed">
                    {analysis.problemsSolved}
                  </AccordionContent>
                </AccordionItem>
              )}

              {analysis.novelApproaches && (
                <AccordionItem value="novel" className="border-slate-700">
                  <AccordionTrigger className="text-sm text-slate-200 hover:text-white flex items-center gap-2">
                    <Lightbulb className="h-4 w-4" />
                    Novel Approaches & Innovation
                  </AccordionTrigger>
                  <AccordionContent className="text-sm text-slate-400 leading-relaxed">
                    {analysis.novelApproaches}
                  </AccordionContent>
                </AccordionItem>
              )}

              {analysis.testingStrategy && (
                <AccordionItem value="testing" className="border-slate-700">
                  <AccordionTrigger className="text-sm text-slate-200 hover:text-white flex items-center gap-2">
                    <TestTube className="h-4 w-4" />
                    Testing & Quality Practices
                  </AccordionTrigger>
                  <AccordionContent className="text-sm text-slate-400 leading-relaxed">
                    {analysis.testingStrategy}
                  </AccordionContent>
                </AccordionItem>
              )}

              {analysis.architectureInsights && (
                <AccordionItem value="architecture" className="border-slate-700">
                  <AccordionTrigger className="text-sm text-slate-200 hover:text-white">
                    Architecture & System Design
                  </AccordionTrigger>
                  <AccordionContent className="text-sm text-slate-400 leading-relaxed">
                    {analysis.architectureInsights}
                  </AccordionContent>
                </AccordionItem>
              )}
            </Accordion>

            {/* Repository Details (no links) */}
            <div className="mt-4 pt-4 border-t border-slate-700">
              <h4 className="text-xs font-semibold text-slate-400 mb-2">Project Components:</h4>
              <div className="flex flex-wrap gap-2">
                {project.repositories.map((repo) => (
                  <Badge key={repo.id} variant="outline" className="text-xs text-slate-400 border-slate-600">
                    {repo.name}
                    {repo.language && ` • ${repo.language}`}
                  </Badge>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center py-8">
            <p className="text-slate-400 text-sm mb-4">
              This project hasn't been analyzed yet.
            </p>
            <div className="flex flex-wrap gap-2 justify-center">
              {project.repositories.map((repo) => (
                <Badge key={repo.id} variant="outline" className="text-slate-400 border-slate-600">
                  {repo.name}
                </Badge>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
