import React, { useState } from 'react';
import { MainLayout } from '@/components/layouts/MainLayout';
import { 
  Search, 
  Clock, 
  BarChart, 
  Mic2, 
  Briefcase, 
  User, 
  Sparkles, 
  Info, 
  ChevronRight,
  Filter,
  CheckCircle2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Link } from 'react-router-dom';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

const categories = [
  { id: 'all', name: 'All Scenarios' },
  { id: 'everyday', name: 'Everyday Confidence' },
  { id: 'high-stakes', name: 'High-Stakes Speaking' },
  { id: 'identity', name: 'Expression & Identity' },
];

const scenarios = [
  {
    id: 'pitch-coach',
    title: 'Pitch Coach',
    description: 'Refine your startup or project pitch for high impact and clarity.',
    difficulty: 'Intermediate',
    time: '15m',
    category: 'high-stakes',
    icon: Sparkles,
    completed: true,
  },
  {
    id: 'interview-practice',
    title: 'Interview Practice',
    description: 'Ace common and unexpected interview questions with confidence.',
    difficulty: 'Advanced',
    time: '25m',
    category: 'high-stakes',
    icon: Briefcase,
    completed: false,
  },
  {
    id: 'small-talk',
    title: 'Mastering Small Talk',
    description: 'Learn how to build rapport and handle social interactions smoothly.',
    difficulty: 'Beginner',
    time: '10m',
    category: 'everyday',
    icon: User,
    completed: true,
  },
  {
    id: 'asking-help',
    title: 'Asking for Help',
    description: 'Structure your request for help clearly and professionally.',
    difficulty: 'Beginner',
    time: '8m',
    category: 'everyday',
    icon: Info,
    completed: false,
  },
  {
    id: 'defending-idea',
    title: 'Defending an Idea',
    description: 'Learn to handle pushback and articulate your vision logically.',
    difficulty: 'Advanced',
    time: '15m',
    category: 'identity',
    icon: Mic2,
    completed: false,
  },
  {
    id: 'telling-story',
    title: 'Telling Your Story',
    description: 'Craft a compelling narrative about your journey and identity.',
    difficulty: 'Intermediate',
    time: '20m',
    category: 'identity',
    icon: User,
    completed: false,
  },
];

export default function Scenarios() {
  const [activeCategory, setActiveCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  const filteredScenarios = scenarios.filter(scenario => {
    const matchesCategory = activeCategory === 'all' || scenario.category === activeCategory;
    const matchesSearch = scenario.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                         scenario.description.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  return (
    <MainLayout>
      <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-8 animate-fade-in">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div>
            <h1 className="text-3xl font-bold tracking-tight mb-2">Practice Scenarios</h1>
            <p className="text-muted-foreground">Select a challenge to start building your confidence.</p>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
            <div className="relative group w-full sm:w-80">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
              <Input 
                placeholder="Search scenarios..." 
                className="pl-10 bg-card/50 border-white/5 focus-visible:ring-primary h-11"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>
        </div>

        <Tabs defaultValue="all" onValueChange={setActiveCategory} className="w-full">
          <TabsList className="bg-card/50 border-white/5 p-1 h-12">
            {categories.map((cat) => (
              <TabsTrigger 
                key={cat.id} 
                value={cat.id} 
                className="px-6 py-2 rounded-lg data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
              >
                {cat.name}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredScenarios.map((scenario) => (
            <Card 
              key={scenario.id} 
              className="bg-card/50 border-white/5 hover:border-primary/20 hover:shadow-xl hover:shadow-primary/5 transition-all group overflow-hidden flex flex-col"
            >
              <CardHeader className="pb-4">
                <div className="flex justify-between items-start mb-4">
                  <div className="h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-all duration-300">
                    <scenario.icon className="h-6 w-6" />
                  </div>
                  {scenario.completed && (
                    <Badge variant="secondary" className="bg-green-500/10 text-green-500 border-green-500/20 gap-1 font-medium">
                      <CheckCircle2 className="h-3 w-3" />
                      Completed
                    </Badge>
                  )}
                </div>
                <CardTitle className="text-xl group-hover:text-primary transition-colors">{scenario.title}</CardTitle>
                <CardDescription className="line-clamp-2 min-h-[40px] leading-relaxed">
                  {scenario.description}
                </CardDescription>
              </CardHeader>
              <CardContent className="pb-6">
                <div className="flex items-center gap-4 text-sm font-medium">
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <BarChart className="h-4 w-4" />
                    {scenario.difficulty}
                  </div>
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <Clock className="h-4 w-4" />
                    {scenario.time}
                  </div>
                </div>
              </CardContent>
              <CardFooter className="mt-auto pt-0">
                <Link to={`/session/${scenario.id}`} className="w-full">
                  <Button className="w-full gap-2 rounded-xl h-11 transition-all group-hover:shadow-[0_0_15px_rgba(139,92,246,0.3)]" onClick={() => {}}>
                    Start Scenario
                    <ChevronRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
                  </Button>
                </Link>
              </CardFooter>
            </Card>
          ))}
        </div>

        {filteredScenarios.length === 0 && (
          <div className="py-24 text-center">
            <div className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-muted mb-4">
              <Search className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="text-xl font-bold mb-2">No scenarios found</h3>
            <p className="text-muted-foreground">Try adjusting your filters or search query.</p>
            <Button 
              variant="link" 
              className="text-primary mt-2"
              onClick={() => { setActiveCategory('all'); setSearchQuery(''); }}
            >
              Clear all filters
            </Button>
          </div>
        )}
      </div>
    </MainLayout>
  );
}
