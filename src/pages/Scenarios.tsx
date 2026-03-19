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
  CheckCircle2,
  MessageSquare,
  Target,
  Heart
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Link } from 'react-router-dom';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { motion } from 'framer-motion';

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
    icon: MessageSquare,
    completed: true,
  },
  {
    id: 'asking-help',
    title: 'Asking for Help',
    description: 'Structure your request for help clearly and professionally.',
    difficulty: 'Beginner',
    time: '8m',
    category: 'everyday',
    icon: Heart,
    completed: false,
  },
  {
    id: 'defending-idea',
    title: 'Defending an Idea',
    description: 'Learn to handle pushback and articulate your vision logically.',
    difficulty: 'Advanced',
    time: '15m',
    category: 'identity',
    icon: Target,
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

const difficultyColors = {
  'Beginner': 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20',
  'Intermediate': 'text-cyan-400 bg-cyan-400/10 border-cyan-400/20',
  'Advanced': 'text-violet-400 bg-violet-400/10 border-violet-400/20',
};

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
      <div className="p-6 md:p-10 max-w-7xl mx-auto space-y-10">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div>
            <h1 className="text-4xl font-bold tracking-tight mb-3">Practice Scenarios</h1>
            <p className="text-muted-foreground text-lg font-light">Select a challenge to start building your confidence.</p>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
            <div className="relative group w-full sm:w-80">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
              <Input 
                placeholder="Search scenarios..." 
                className="pl-10 bg-card border-border focus-visible:ring-primary h-11"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>
        </div>

        <Tabs defaultValue="all" onValueChange={setActiveCategory} className="w-full">
          <TabsList className="bg-card border border-border p-1 h-12">
            {categories.map((cat) => (
              <TabsTrigger 
                key={cat.id} 
                value={cat.id} 
                className="px-6 py-2 rounded-lg data-[state=active]:bg-primary data-[state=active]:text-primary-foreground font-medium"
              >
                {cat.name}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredScenarios.map((scenario, idx) => (
            <motion.div
              key={scenario.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: idx * 0.05 }}
            >
              <Card 
                className="bg-card border-border hover:border-primary/50 transition-all group overflow-hidden flex flex-col h-full"
              >
                <CardHeader className="pb-4 space-y-4">
                  <div className="flex justify-between items-start">
                    <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                      <scenario.icon className="h-6 w-6 text-primary" />
                    </div>
                    {scenario.completed && (
                      <Badge variant="secondary" className="bg-emerald-400/10 text-emerald-400 border-emerald-400/20">
                        <CheckCircle2 className="h-3 w-3 mr-1" />
                        Completed
                      </Badge>
                    )}
                  </div>
                  <div>
                    <CardTitle className="text-xl mb-2 group-hover:text-primary transition-colors">{scenario.title}</CardTitle>
                    <CardDescription className="text-muted-foreground leading-relaxed font-light">
                      {scenario.description}
                    </CardDescription>
                  </div>
                </CardHeader>
                <CardContent className="pt-0 mt-auto">
                  <div className="flex items-center gap-3 mb-4">
                    <Badge variant="outline" className={difficultyColors[scenario.difficulty as keyof typeof difficultyColors]}>
                      <BarChart className="h-3 w-3 mr-1" />
                      {scenario.difficulty}
                    </Badge>
                    <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                      <Clock className="h-3.5 w-3.5" />
                      <span>{scenario.time}</span>
                    </div>
                  </div>
                  <Link to="/live-session">
                    <Button className="w-full font-medium group-hover:glow-accent" onClick={() => {}}>
                      Start Practice
                      <ChevronRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>

        {filteredScenarios.length === 0 && (
          <div className="text-center py-20">
            <div className="h-16 w-16 rounded-2xl bg-muted/50 flex items-center justify-center mx-auto mb-6">
              <Search className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="text-xl font-semibold mb-2">No scenarios found</h3>
            <p className="text-muted-foreground font-light">Try adjusting your search or filters</p>
          </div>
        )}
      </div>
    </MainLayout>
  );
}
