import React from 'react';
import { MainLayout } from '@/components/layouts/MainLayout';
import { 
  Trophy, 
  Zap, 
  Target, 
  TrendingUp, 
  Clock, 
  ChevronRight, 
  RotateCcw, 
  LayoutDashboard,
  Sparkles,
  MessageSquare,
  AlertCircle,
  Video
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';

const scores = [
  { label: 'Clarity', value: 85, icon: Zap, color: 'text-cyan-500', bg: 'bg-cyan-500/10' },
  { label: 'Confidence', value: 78, icon: Target, color: 'text-green-500', bg: 'bg-green-500/10' },
  { label: 'Pace', value: 92, icon: TrendingUp, color: 'text-primary', bg: 'bg-primary/10' },
  { label: 'Eye Contact', value: 65, icon: Video, color: 'text-orange-500', bg: 'bg-orange-500/10' },
];

const insights = [
  {
    title: 'Best Moment',
    description: 'Your opening hook was exceptionally clear and engaging. You maintained high energy and clarity throughout the first 2 minutes.',
    icon: Sparkles,
    color: 'text-yellow-500',
    bg: 'bg-yellow-500/10',
  },
  {
    title: 'Improvement Area',
    description: 'You tended to use filler words (um, ah) when transitioning between technical points. Try pausing for a second instead.',
    icon: AlertCircle,
    color: 'text-destructive',
    bg: 'bg-destructive/10',
  },
  {
    title: 'Next Challenge',
    description: 'Try the "Handling Objections" scenario next to practice maintaining your confidence when facing tough questions.',
    icon: Target,
    color: 'text-primary',
    bg: 'bg-primary/10',
  },
];

export default function Results() {
  return (
    <MainLayout>
      <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-8 animate-fade-in pb-20">
        <div className="text-center space-y-4 mb-12">
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.5 }}
            className="inline-flex h-20 w-20 items-center justify-center rounded-full bg-primary/20 mb-4"
          >
            <Trophy className="h-10 w-10 text-primary shadow-glow" />
          </motion.div>
          <h1 className="text-4xl font-extrabold tracking-tight">Session Complete!</h1>
          <p className="text-muted-foreground max-w-lg mx-auto">
            Great job on your Pitch Coach practice. You've shown significant improvement in your delivery speed.
          </p>
        </div>

        {/* Scores Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
          {scores.map((score, idx) => (
            <motion.div
              key={idx}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.1 }}
            >
              <Card className="bg-card border-border hover:border-primary/20 transition-all overflow-hidden relative group">
                <div className={cn("absolute top-0 right-0 p-4 opacity-10 group-hover:scale-110 transition-transform", score.color)}>
                  <score.icon className="h-12 w-12" />
                </div>
                <CardHeader className="pb-2">
                  <div className={cn("h-8 w-8 rounded-lg flex items-center justify-center mb-2", score.bg)}>
                    <score.icon className={cn("h-4 w-4", score.color)} />
                  </div>
                  <CardDescription className="text-xs font-bold uppercase tracking-wider">{score.label}</CardDescription>
                  <CardTitle className="text-4xl font-bold">{score.value}%</CardTitle>
              </CardHeader>
              <CardContent>
                <Progress value={score.value} className="h-1 bg-secondary" />
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Insights Section */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {insights.map((insight, idx) => (
          <Card key={idx} className="bg-card border-border flex flex-col h-full">
            <CardHeader>
              <div className={cn("h-10 w-10 rounded-xl flex items-center justify-center mb-4", insight.bg)}>
                <insight.icon className={cn("h-5 w-5", insight.color)} />
              </div>
              <CardTitle className="text-lg">{insight.title}</CardTitle>
            </CardHeader>
            <CardContent className="flex-1">
              <p className="text-sm text-muted-foreground leading-relaxed">
                {insight.description}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Transcript Summary Placeholder */}
      <Card className="bg-card border-border">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-xl">Transcript Summary</CardTitle>
            <CardDescription>AI-generated highlights from your session</CardDescription>
          </div>
          <Button variant="ghost" size="sm" className="gap-2" onClick={() => {}}>
            <MessageSquare className="h-4 w-4" />
            View Full Transcript
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="p-4 rounded-xl bg-secondary border border-border space-y-3">
            <div className="flex items-center gap-2 text-xs font-bold uppercase text-primary">
              <Clock className="h-3 w-3" />
              0:45 - High Engagement
            </div>
            <p className="text-sm text-muted-foreground italic">
              "...The unique value proposition is our proprietary AI that analyzes voice patterns in real-time..."
            </p>
          </div>
          <div className="p-4 rounded-xl bg-secondary border border-border space-y-3">
            <div className="flex items-center gap-2 text-xs font-bold uppercase text-destructive">
              <AlertCircle className="h-3 w-3" />
              1:20 - Filler Word Detected
            </div>
            <p className="text-sm text-muted-foreground italic">
              "...So, um, the way we handle data security is through end-to-end encryption..."
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Action Buttons */}
      <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-8">
        <Link to="/session/pitch-coach">
          <Button size="lg" variant="outline" className="rounded-full px-8 gap-2 border-border hover:bg-secondary" onClick={() => {}}>
            <RotateCcw className="h-5 w-5" />
            Retry Session
          </Button>
        </Link>
        <Link to="/dashboard">
          <Button size="lg" className="rounded-full px-8 gap-2 bg-primary text-primary-foreground font-bold" onClick={() => {}}>
            <LayoutDashboard className="h-5 w-5" />
            Back to Dashboard
          </Button>
        </Link>
        <Link to="/scenarios">
          <Button size="lg" variant="ghost" className="rounded-full px-8 gap-2 group" onClick={() => {}}>
            Try Another Scenario
            <ChevronRight className="h-5 w-5 group-hover:translate-x-1 transition-transform" />
          </Button>
        </Link>
      </div>
      </div>
    </MainLayout>
  );
}

function cn(...inputs: any[]) {
  return inputs.filter(Boolean).join(' ');
}
