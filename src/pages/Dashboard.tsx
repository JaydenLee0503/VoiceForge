import React from 'react';
import { MainLayout } from '@/components/layouts/MainLayout';
import { 
  Trophy, 
  Flame, 
  Zap, 
  Target, 
  Play, 
  Calendar,
  Clock,
  ChevronRight,
  TrendingUp,
  BarChart2,
  ArrowRight
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Link } from 'react-router-dom';

const stats = [
  { label: 'Sessions', value: '12', icon: Play, color: 'text-primary' },
  { label: 'Streak', value: '4 days', icon: Flame, color: 'text-orange-400' },
  { label: 'Confidence', value: '82%', icon: Target, color: 'text-emerald-400' },
  { label: 'Clarity', value: '78%', icon: Zap, color: 'text-cyan-400' },
];

const recentSessions = [
  { id: '1', scenario: 'Pitch Coach', date: 'Oct 24, 2026', confidence: 85, clarity: 80, duration: '12m' },
  { id: '2', scenario: 'Interview Practice', date: 'Oct 22, 2026', confidence: 78, clarity: 75, duration: '24m' },
  { id: '3', scenario: 'Small Talk', date: 'Oct 20, 2026', confidence: 92, clarity: 88, duration: '8m' },
];

export default function Dashboard() {
  return (
    <MainLayout>
      <div className="p-6 md:p-10 max-w-7xl mx-auto space-y-10">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <h1 className="text-4xl font-bold tracking-tight mb-2">Welcome back, Alex</h1>
            <p className="text-muted-foreground text-lg">You're on a 4-day streak. Keep building your voice.</p>
          </div>
          <div className="flex items-center gap-3">
            <Link to="/scenarios">
              <Button className="gap-2 h-11 px-6 font-medium glow-accent" onClick={() => {}}>
                <Play className="h-4 w-4" />
                Start Session
              </Button>
            </Link>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {stats.map((stat, idx) => (
            <Card key={idx} className="border-border bg-card hover:border-primary/50 transition-all">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between mb-2">
                  <stat.icon className={cn("h-5 w-5", stat.color)} />
                </div>
                <CardTitle className="text-3xl font-bold">{stat.value}</CardTitle>
                <CardDescription className="text-xs font-medium uppercase tracking-wider">{stat.label}</CardDescription>
              </CardHeader>
            </Card>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-8">
            <Card className="border-border bg-card">
              <CardHeader className="border-b border-border pb-6">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-xl font-semibold">Continue Practicing</CardTitle>
                    <CardDescription className="mt-1">Pick up where you left off</CardDescription>
                  </div>
                  <Badge variant="secondary" className="bg-primary/10 text-primary border-primary/20">In Progress</Badge>
                </div>
              </CardHeader>
              <CardContent className="pt-6 space-y-6">
                <div className="flex items-center justify-between gap-4 p-5 rounded-xl border border-border bg-secondary/30 hover:border-primary/50 transition-all cursor-pointer">
                  <div className="flex items-center gap-4">
                    <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                      <Zap className="h-6 w-6" />
                    </div>
                    <div>
                      <h4 className="font-semibold">Pitching Your Startup Idea</h4>
                      <p className="text-sm text-muted-foreground">Scenario • Intermediate</p>
                    </div>
                  </div>
                  <ChevronRight className="h-5 w-5 text-muted-foreground" />
                </div>
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground font-medium">Overall Goal: Confidence Mastery</span>
                    <span className="font-semibold">65%</span>
                  </div>
                  <Progress value={65} className="h-2" />
                </div>
              </CardContent>
            </Card>

            <Card className="border-border bg-card">
              <CardHeader className="flex flex-row items-center justify-between border-b border-border pb-6">
                <CardTitle className="text-xl font-semibold">Weekly Progress</CardTitle>
                <BarChart2 className="h-5 w-5 text-muted-foreground" />
              </CardHeader>
              <CardContent className="pt-6">
                <div className="h-[200px] w-full rounded-xl border border-border bg-secondary/20 flex items-center justify-center relative overflow-hidden">
                   <div className="flex items-end gap-3 px-8 w-full h-full pt-12">
                      {[40, 70, 45, 90, 65, 80, 50].map((h, i) => (
                        <div 
                          key={i} 
                          className="flex-1 bg-primary/20 hover:bg-primary/40 rounded-t transition-all cursor-pointer relative group"
                          style={{ height: `${h}%` }}
                        >
                          <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-popover text-popover-foreground text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity">
                            {h}%
                          </div>
                        </div>
                      ))}
                   </div>
                </div>
                <div className="flex justify-between mt-4 text-xs text-muted-foreground font-medium px-2">
                  <span>Mon</span><span>Tue</span><span>Wed</span><span>Thu</span><span>Fri</span><span>Sat</span><span>Sun</span>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-8">
            <Card className="border-primary/30 bg-gradient-to-br from-primary/10 to-transparent">
              <CardHeader className="pb-4">
                <CardTitle className="text-lg font-semibold flex items-center gap-2">
                  <Trophy className="h-5 w-5 text-yellow-400" />
                  Today's Focus
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <p className="font-medium">Clarity & Enunciation</p>
                  <p className="text-sm text-muted-foreground leading-relaxed">Work on reducing filler words like "um" and "ah".</p>
                </div>
                <Button className="w-full font-medium h-10" onClick={() => {}}>
                  Practice Now
                </Button>
              </CardContent>
            </Card>

            <div className="space-y-4">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground px-1">Recent Sessions</h3>
              <div className="space-y-3">
                {recentSessions.map((session) => (
                  <Link key={session.id} to={`/session/${session.id}`}>
                    <div className="p-4 rounded-xl border border-border bg-card hover:border-primary/50 transition-all cursor-pointer">
                      <div className="flex items-center justify-between mb-3">
                        <span className="font-semibold text-sm">{session.scenario}</span>
                        <span className="text-xs text-muted-foreground">{session.date}</span>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="flex items-center gap-1.5">
                          <Target className="h-3.5 w-3.5 text-emerald-400" />
                          <span className="text-xs font-medium">{session.confidence}%</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Zap className="h-3.5 w-3.5 text-cyan-400" />
                          <span className="text-xs font-medium">{session.clarity}%</span>
                        </div>
                        <div className="ml-auto flex items-center gap-1 text-xs text-muted-foreground">
                          <Clock className="h-3.5 w-3.5" />
                          {session.duration}
                        </div>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
              <Link to="/history">
                <Button variant="ghost" className="w-full text-sm text-muted-foreground hover:text-foreground" onClick={() => {}}>
                  View all history
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}

function cn(...inputs: any[]) {
  return inputs.filter(Boolean).join(' ');
}
