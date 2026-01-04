'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import {
  Github,
  Sparkles,
  Briefcase,
  Code2,
  Award,
  Copy,
  Check,
  Stars
} from 'lucide-react';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { useState } from 'react';
import ProjectCard from './project-card';
import RepositoryCard from './repository-card';
import EngineeringDNA from '@/components/engineering-dna';

interface PortfolioClientProps {
  data: any;
}

export default function PortfolioClient({ data }: PortfolioClientProps) {
  const [copied, setCopied] = useState(false);
  
  const projects = data?.projects ?? [];
  const repositories = data?.repositories ?? [];
  const githubUsername = data?.githubUsername ?? '';
  const allRepos = useMemo(() => {
    const projectRepos = projects.flatMap((p: any) => p?.repositories ?? []);
    const combined = [...repositories, ...projectRepos];
    const byId = new Map<string, any>();
    combined.forEach((r: any) => {
      if (r?.id) byId.set(r.id, r);
    });
    return Array.from(byId.values());
  }, [projects, repositories]);

  // Calculate aggregate skills across all projects and repositories
  const aggregateSkills = useMemo(() => {
    const skillsSet = new Set<string>();
    const techStackSet = new Set<string>();
    
    // From projects
    projects?.forEach((project: any) => {
      const analysis = project?.aiAnalysis;
      if (Array.isArray(analysis?.technicalSkills)) {
        analysis.technicalSkills.forEach((skill: string) => {
          const trimmed = String(skill ?? '').trim();
          if (trimmed) skillsSet.add(trimmed);
        });
      }
      if (Array.isArray(analysis?.techStack)) {
        analysis.techStack.forEach((tech: string) => {
          const trimmed = String(tech ?? '').trim();
          if (trimmed) techStackSet.add(trimmed);
        });
      }
    });
    
    // From individual repositories
    repositories?.forEach((repo: any) => {
      const analysis = repo?.aiAnalysis;
      if (Array.isArray(analysis?.skillsDemonstrated)) {
        analysis.skillsDemonstrated.forEach((skill: string) => {
          const trimmed = String(skill ?? '').trim();
          if (trimmed) skillsSet.add(trimmed);
        });
      }
      if (Array.isArray(analysis?.techStack)) {
        analysis.techStack.forEach((tech: string) => {
          const trimmed = String(tech ?? '').trim();
          if (trimmed) techStackSet.add(trimmed);
        });
      }
      if (repo?.language) techStackSet.add(repo.language);
    });
    
    return {
      skills: Array.from(skillsSet).slice(0, 12),
      techStack: Array.from(techStackSet).slice(0, 15),
    };
  }, [projects, repositories]);

  const targetRoles = useMemo(() => {
    const stack = new Set(aggregateSkills.techStack.map((t: string) => t.toLowerCase()));
    const skills = new Set(aggregateSkills.skills.map((s: string) => s.toLowerCase()));
    const roles: string[] = [];

    const add = (label: string) => {
      if (!roles.includes(label)) roles.push(label);
    };

    if (stack.has('react') || stack.has('nextjs') || stack.has('typescript') || skills.has('frontend')) add('Frontend / UI');
    if (stack.has('node') || stack.has('express') || stack.has('python') || stack.has('django') || stack.has('golang') || skills.has('backend')) add('Backend / APIs');
    if (stack.has('docker') || stack.has('kubernetes') || skills.has('devops')) add('Platform / DevOps');
    if (stack.has('postgres') || stack.has('mysql') || stack.has('mongodb')) add('Data & Storage');
    if (stack.has('pytorch') || stack.has('tensorflow') || skills.has('ml') || skills.has('ai')) add('AI / ML');
    if (stack.has('aws') || stack.has('gcp') || stack.has('azure')) add('Cloud');

    if (roles.length === 0) roles.push('Full-Stack Engineering');
    return roles.slice(0, 4);
  }, [aggregateSkills]);

  const highlightRepos = useMemo(() => {
    const withAnalysis = allRepos.filter((r: any) => r?.aiAnalysis?.employerHighlights);
    const sorted = withAnalysis.sort((a: any, b: any) => {
      const aScore = (a.isFeatured ? 1 : 0) * 1000 + (a.stargazersCount ?? 0);
      const bScore = (b.isFeatured ? 1 : 0) * 1000 + (b.stargazersCount ?? 0);
      return bScore - aScore;
    });
    return sorted.slice(0, 3);
  }, [allRepos]);

  const handleCopyUrl = () => {
    const url = window.location.href;
    navigator.clipboard.writeText(url);
    setCopied(true);
    toast.success('Portfolio URL copied to clipboard!');
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-slate-900 to-cyan-900">
      {/* Header */}
      <header className="bg-slate-900/50 backdrop-blur-lg border-b border-slate-800 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <Link href="/" className="flex items-center gap-2">
              <div className="bg-gradient-to-br from-purple-600 to-blue-600 p-2 rounded-lg">
                <Code2 className="w-5 h-5 text-white" />
              </div>
              <span className="text-2xl font-bold text-white">
                RepoNexus
              </span>
            </Link>
            <div className="flex items-center gap-3">
              <Button 
                variant="outline" 
                size="sm"
                onClick={handleCopyUrl}
                className="border-slate-600 text-slate-200 hover:bg-slate-800"
              >
                {copied ? (
                  <>
                    <Check className="w-4 h-4 mr-2" />
                    Copied!
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4 mr-2" />
                    Share Portfolio
                  </>
                )}
              </Button>
              <Link href="/auth/signin">
                <Button className="bg-gradient-to-r from-purple-500 to-cyan-500 hover:from-purple-600 hover:to-cyan-600">
                  Create Your Portfolio
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="py-16 px-6">
        <div className="max-w-7xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="text-center mb-12"
          >
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-purple-500/10 border border-purple-500/20 mb-6">
              <Briefcase className="w-4 h-4 text-purple-400" />
              <span className="text-sm text-purple-300">Developer Portfolio</span>
            </div>
            <h1 className="text-6xl font-bold mb-4 text-white">
              {githubUsername}
            </h1>
            <p className="text-xl text-slate-300 max-w-2xl mx-auto mb-6">
              Technical skills and engineering capabilities demonstrated through real projects
            </p>

            {targetRoles?.length > 0 && (
              <div className="flex flex-wrap justify-center gap-3 mb-8">
                {targetRoles.map((role) => (
                  <span
                    key={role}
                    className="px-3 py-1.5 rounded-full bg-slate-800/70 border border-slate-700 text-slate-200 text-sm flex items-center gap-2"
                  >
                    <Stars className="w-4 h-4 text-amber-400" />
                    {role}
                  </span>
                ))}
              </div>
            )}
            
              {/* Quick Stats - Centered Grid based on available items */}
              <div className={`grid gap-6 max-w-4xl mx-auto ${
                projects?.length > 0 ? 'grid-cols-1 md:grid-cols-3' : 'grid-cols-1 md:grid-cols-2 max-w-2xl'
              }`}>
              {projects?.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, delay: 0.1 }}
                  className="bg-slate-800/50 backdrop-blur-lg border border-slate-700 rounded-2xl p-6"
                >
                  <div className="flex items-center justify-center gap-3 mb-2">
                    <Briefcase className="w-6 h-6 text-purple-400" />
                    <span className="text-3xl font-bold text-white">{projects?.length ?? 0}</span>
                  </div>
                  <p className="text-slate-400">Major Projects</p>
                </motion.div>
              )}
              
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.2 }}
                className="bg-slate-800/50 backdrop-blur-lg border border-slate-700 rounded-2xl p-6"
              >
                <div className="flex items-center justify-center gap-3 mb-2">
                  <Code2 className="w-6 h-6 text-cyan-400" />
                  <span className="text-3xl font-bold text-white">{repositories?.length ?? 0}</span>
                </div>
                <p className="text-slate-400">Technical Works</p>
              </motion.div>
              
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.3 }}
                className="bg-slate-800/50 backdrop-blur-lg border border-slate-700 rounded-2xl p-6"
              >
                <div className="flex items-center justify-center gap-3 mb-2">
                  <Award className="w-6 h-6 text-green-400" />
                  <span className="text-3xl font-bold text-white">{aggregateSkills?.skills?.length ?? 0}</span>
                </div>
                <p className="text-slate-400">Key Skills</p>
              </motion.div>
            </div>
          </motion.div>

          {/* Technical Skills Overview */}
          {aggregateSkills?.skills?.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.4 }}
              className="bg-slate-800/50 backdrop-blur-lg border border-slate-700 rounded-2xl p-8 mb-8"
            >
              <div className="flex items-center gap-2 mb-4">
                <Sparkles className="w-5 h-5 text-purple-400" />
                <h3 className="text-xl font-semibold text-white">Technical Competencies</h3>
              </div>
              <div className="flex flex-wrap gap-2">
                {aggregateSkills.skills.map((skill) => (
                  <span
                    key={skill}
                    className="px-3 py-1.5 bg-purple-500/10 border border-purple-500/20 rounded-lg text-purple-300 text-sm"
                  >
                    {skill}
                  </span>
                ))}
              </div>
            </motion.div>
          )}

          {/* Tech Stack */}
          {aggregateSkills?.techStack?.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.5 }}
              className="bg-slate-800/50 backdrop-blur-lg border border-slate-700 rounded-2xl p-8"
            >
              <div className="flex items-center gap-2 mb-4">
                <Code2 className="w-5 h-5 text-cyan-400" />
                <h3 className="text-xl font-semibold text-white">Technology Stack</h3>
              </div>
              <div className="flex flex-wrap gap-2">
                {aggregateSkills.techStack.map((tech) => (
                  <span
                    key={tech}
                    className="px-3 py-1.5 bg-cyan-500/10 border border-cyan-500/20 rounded-lg text-cyan-300 text-sm"
                  >
                    {tech}
                  </span>
                ))}
              </div>
            </motion.div>
          )}
        </div>
      </section>

      {/* Employer Highlights Strip */}
      {highlightRepos.length > 0 && (
        <section className="px-6">
          <div className="max-w-7xl mx-auto">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 mb-10"
            >
              <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
                <div className="flex items-center gap-2">
                  <Stars className="w-5 h-5 text-amber-400" />
                  <h3 className="text-lg font-semibold text-white">Employer Highlights</h3>
                </div>
                <p className="text-sm text-slate-400">Top evidence-backed repos to open first</p>
              </div>
              <div className="grid md:grid-cols-3 gap-4">
                {highlightRepos.map((repo: any, idx: number) => (
                  <motion.div
                    key={repo?.id ?? idx}
                    initial={{ opacity: 0, y: 10 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.35, delay: 0.05 * idx }}
                    className="p-4 rounded-xl bg-slate-800/60 border border-slate-700 h-full flex flex-col gap-3"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-xs uppercase tracking-wide text-slate-500 mb-1">Repo</p>
                        <p className="text-base font-semibold text-white line-clamp-1">{repo?.name}</p>
                      </div>
                      <div className="flex items-center gap-1 text-amber-300 text-sm">
                        <Stars className="w-4 h-4" />
                        <span>{repo?.stargazersCount ?? 0}</span>
                      </div>
                    </div>
                    {repo?.aiAnalysis?.employerHighlights && (
                      <p className="text-sm text-slate-300 line-clamp-3 leading-relaxed">
                        {repo.aiAnalysis.employerHighlights}
                      </p>
                    )}
                    {repo?.aiAnalysis?.skillsDemonstrated?.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {repo.aiAnalysis.skillsDemonstrated.slice(0, 3).map((skill: string, skillIdx: number) => (
                          <span
                            key={skillIdx}
                            className="px-2 py-1 rounded-md bg-purple-500/10 border border-purple-500/20 text-xs text-purple-200"
                          >
                            {skill}
                          </span>
                        ))}
                      </div>
                    )}
                  </motion.div>
                ))}
              </div>
            </motion.div>
          </div>
        </section>
      )}

      {/* Engineering DNA Section */}
      <EngineeringDNA username={githubUsername} />

      {/* Major Projects Section */}
      {projects?.length > 0 && (
        <section className="py-12 px-6">
          <div className="max-w-7xl mx-auto">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
            >
              <div className="flex items-center gap-3 mb-8">
                <Briefcase className="w-7 h-7 text-purple-400" />
                <h2 className="text-4xl font-bold text-white">Major Projects</h2>
              </div>
              <p className="text-slate-300 mb-8 text-lg">
                Complex, multi-faceted projects demonstrating technical evolution and engineering maturity
              </p>
              <div className="space-y-6">
                {projects.map((project: any, index: number) => (
                  <motion.div
                    key={project?.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6, delay: 0.1 * index }}
                  >
                    <ProjectCard project={project} />
                  </motion.div>
                ))}
              </div>
            </motion.div>
          </div>
        </section>
      )}

      {/* Individual Technical Works */}
      {repositories?.length > 0 && (
        <section className="py-12 px-6 pb-24">
          <div className="max-w-7xl mx-auto">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
            >
              <div className="flex items-center gap-3 mb-8">
                <Code2 className="w-7 h-7 text-cyan-400" />
                <h2 className="text-4xl font-bold text-white">Individual Technical Works</h2>
              </div>
              <p className="text-slate-300 mb-8 text-lg">
                Focused implementations showcasing specific technical skills and problem-solving approaches
              </p>
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                {repositories.map((repo: any, index: number) => (
                  <motion.div
                    key={repo?.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4, delay: 0.05 * index }}
                  >
                    <RepositoryCard repository={repo} />
                  </motion.div>
                ))}
              </div>
            </motion.div>
          </div>
        </section>
      )}

      {/* Empty State */}
      {projects?.length === 0 && repositories?.length === 0 && (
        <section className="py-24 px-6">
          <div className="max-w-2xl mx-auto text-center">
            <Github className="w-16 h-16 text-slate-600 mx-auto mb-6" />
            <h2 className="text-2xl font-bold text-white mb-4">Portfolio In Progress</h2>
            <p className="text-slate-400 mb-8">
              This developer is currently curating their portfolio. Check back soon to see their amazing work!
            </p>
          </div>
        </section>
      )}
    </div>
  );
}
