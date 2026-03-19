import React, { useState } from 'react';
import { MainLayout } from '@/components/layouts/MainLayout';
import { 
  Search, 
  Calendar, 
  Clock, 
  ChevronRight, 
  Filter, 
  BarChart, 
  Zap, 
  Target, 
  TrendingUp, 
  MoreHorizontal,
  History as HistoryIcon,
  CheckCircle2,
  Trash2,
  Share2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from '@/components/ui/dropdown-menu';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { Link } from 'react-router-dom';

const sessionHistory = [
  { id: '1', scenario: 'Pitch Coach', date: 'Oct 24, 2026', confidence: 85, clarity: 80, duration: '12m 30s', status: 'completed' },
  { id: '2', scenario: 'Interview Practice', date: 'Oct 22, 2026', confidence: 78, clarity: 75, duration: '24m 15s', status: 'completed' },
  { id: '3', scenario: 'Small Talk', date: 'Oct 20, 2026', confidence: 92, clarity: 88, duration: '8m 45s', status: 'completed' },
  { id: '4', scenario: 'Asking for Help', date: 'Oct 18, 2026', confidence: 65, clarity: 70, duration: '6m 20s', status: 'completed' },
  { id: '5', scenario: 'Defending an Idea', date: 'Oct 15, 2026', confidence: 72, clarity: 68, duration: '15m 10s', status: 'completed' },
  { id: '6', scenario: 'Telling Your Story', date: 'Oct 12, 2026', confidence: 88, clarity: 82, duration: '18m 40s', status: 'completed' },
];

export default function History() {
  const [searchQuery, setSearchQuery] = useState('');

  const filteredHistory = sessionHistory.filter(session => 
    session.scenario.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <MainLayout>
      <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-8 animate-fade-in">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
              <HistoryIcon className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-4xl font-bold tracking-tight mb-1">Session History</h1>
              <p className="text-muted-foreground">Review your past performances and tracking your growth.</p>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
             <div className="relative group w-full sm:w-80">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
              <Input 
                placeholder="Search history..." 
                className="pl-10 bg-card border-border focus-visible:ring-primary h-11"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <Button variant="outline" className="gap-2 h-11 border-border hover:bg-secondary" onClick={() => {}}>
              <Filter className="h-4 w-4" />
              Filters
            </Button>
          </div>
        </div>

        {/* Desktop Table View */}
        <div className="hidden lg:block border rounded-2xl bg-card border-border overflow-hidden">
          <Table>
            <TableHeader className="bg-secondary">
              <TableRow className="border-border hover:bg-transparent">
                <TableHead className="py-5 font-bold uppercase tracking-wider text-[10px] text-muted-foreground px-6">Scenario</TableHead>
                <TableHead className="py-5 font-bold uppercase tracking-wider text-[10px] text-muted-foreground">Date</TableHead>
                <TableHead className="py-5 font-bold uppercase tracking-wider text-[10px] text-muted-foreground">Confidence</TableHead>
                <TableHead className="py-5 font-bold uppercase tracking-wider text-[10px] text-muted-foreground">Clarity</TableHead>
                <TableHead className="py-5 font-bold uppercase tracking-wider text-[10px] text-muted-foreground">Duration</TableHead>
                <TableHead className="py-5 font-bold uppercase tracking-wider text-[10px] text-muted-foreground">Status</TableHead>
                <TableHead className="py-5 text-right px-6"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredHistory.map((session) => (
                <TableRow key={session.id} className="border-border hover:bg-secondary transition-colors group">
                  <TableCell className="py-5 font-bold px-6 group-hover:text-primary transition-colors">
                    {session.scenario}
                  </TableCell>
                  <TableCell className="py-5 text-sm text-muted-foreground font-medium">
                    <div className="flex items-center gap-2">
                      <Calendar className="h-3 w-3" />
                      {session.date}
                    </div>
                  </TableCell>
                  <TableCell className="py-5">
                    <div className="flex items-center gap-2">
                      <Target className="h-3 w-3 text-green-500" />
                      <span className="font-bold text-sm">{session.confidence}%</span>
                    </div>
                  </TableCell>
                  <TableCell className="py-5">
                    <div className="flex items-center gap-2">
                      <Zap className="h-3 w-3 text-cyan-500" />
                      <span className="font-bold text-sm">{session.clarity}%</span>
                    </div>
                  </TableCell>
                  <TableCell className="py-5 text-sm text-muted-foreground font-medium">
                    <div className="flex items-center gap-2">
                      <Clock className="h-3 w-3" />
                      {session.duration}
                    </div>
                  </TableCell>
                  <TableCell className="py-5">
                    <Badge variant="secondary" className="bg-green-500/10 text-green-500 border-green-500/20 font-bold uppercase tracking-widest text-[10px]">
                      {session.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="py-5 text-right px-6">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-48 bg-popover border-border">
                        <DropdownMenuItem className="gap-2 cursor-pointer">
                          <BarChart className="h-4 w-4" /> View Details
                        </DropdownMenuItem>
                        <DropdownMenuItem className="gap-2 cursor-pointer">
                          <Share2 className="h-4 w-4" /> Share Results
                        </DropdownMenuItem>
                        <DropdownMenuItem className="gap-2 cursor-pointer text-destructive">
                          <Trash2 className="h-4 w-4" /> Delete Session
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {/* Mobile/Card List View */}
        <div className="lg:hidden space-y-4">
          {filteredHistory.map((session) => (
            <Card key={session.id} className="bg-card border-border hover:border-primary/20 transition-all">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between mb-2">
                  <Badge variant="secondary" className="bg-primary/10 text-primary border-primary/20 text-[10px] font-bold uppercase tracking-widest">
                    {session.scenario}
                  </Badge>
                  <span className="text-xs text-muted-foreground">{session.date}</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-1">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Confidence</p>
                      <p className="text-lg font-bold">{session.confidence}%</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Clarity</p>
                      <p className="text-lg font-bold">{session.clarity}%</p>
                    </div>
                  </div>
                  <Link to="/results">
                    <Button variant="ghost" size="icon" className="rounded-full bg-secondary h-10 w-10" onClick={() => {}}>
                      <ChevronRight className="h-5 w-5" />
                    </Button>
                  </Link>
                </div>
              </CardHeader>
              <CardContent className="pt-0 pb-4 border-t border-border mt-2 flex items-center justify-between">
                <div className="flex items-center gap-2 pt-3 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                  <Clock className="h-3 w-3" />
                  {session.duration}
                </div>
                <div className="flex items-center gap-2 pt-3">
                   <Button variant="ghost" size="sm" className="h-7 text-[10px] uppercase font-bold tracking-widest" onClick={() => {}}>Share</Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {filteredHistory.length === 0 && (
          <div className="py-24 text-center">
             <div className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-muted mb-4">
              <Search className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="text-xl font-bold mb-2">No session history found</h3>
            <p className="text-muted-foreground">Try adjusting your filters or search query.</p>
          </div>
        )}
      </div>
    </MainLayout>
  );
}

function cn(...inputs: any[]) {
  return inputs.filter(Boolean).join(' ');
}
