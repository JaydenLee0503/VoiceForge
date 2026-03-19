import React, { useState, useEffect, useRef } from 'react';
import { MainLayout } from '@/components/layouts/MainLayout';
import { 
  PlusCircle, 
  Timer, 
  Clock, 
  ChevronRight, 
  MessageSquare,
  Sparkles,
  ArrowRight,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  LayoutDashboard
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';

const mockQuestions = [
  "What is the most challenging feedback you've ever received, and how did you handle it?",
  "Describe a situation where you had to work with a difficult team member. How did you resolve the conflict?",
  "If you were given a budget of $1 million to solve a global problem, what would it be and why?",
  "What's your proudest professional or personal achievement from the last 12 months?",
  "Explain a complex technical concept in simple terms to a 10-year-old.",
  "How do you prioritize your tasks when you have multiple deadlines to meet?",
  "What's the biggest risk you've ever taken, and what was the outcome?",
  "How do you stay motivated when working on a project that's not going as planned?",
  "What's your favorite book or movie, and what's the key takeaway you got from it?",
  "If you could have a conversation with any historical figure, who would it be and why?",
  "Tell me about a time you failed. What did you learn?",
  "Where do you see yourself in five years, and how does your current work align with that vision?",
  "Describe your leadership style using three key adjectives.",
  "How do you handle high-pressure situations or tight deadlines?",
  "What is a unique perspective or skill that you bring to your field?",
  "What's the most innovative idea you've had recently, and have you acted on it?",
  "How do you balance your professional life with your personal growth and well-being?",
  "What's one thing you would change about your industry if you had the power to do so?",
  "Tell me about a time you had to persuade someone to see things from your point of view.",
  "What's the most valuable lesson life has taught you so far?"
];

type SessionStatus = 'preparing' | 'answering' | 'completed';

export default function CustomPracticeSession() {
  const navigate = useNavigate();
  const [config, setConfig] = useState<{ questionsCount: number; prepTime: number; answerTime: number } | null>(null);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [status, setStatus] = useState<SessionStatus>('preparing');
  const [timeLeft, setTimeLeft] = useState(0);
  const [sessionQuestions, setSessionQuestions] = useState<string[]>([]);
  
  // Ref to track if we've already initialized the session
  const isInitialized = useRef(false);

  useEffect(() => {
    if (isInitialized.current) return;
    
    const storedConfig = localStorage.getItem('customPracticeConfig');
    if (!storedConfig) {
      navigate('/custom-practice');
      return;
    }
    
    const parsedConfig = JSON.parse(storedConfig);
    setConfig(parsedConfig);
    
    // Select random questions
    const shuffled = [...mockQuestions].sort(() => 0.5 - Math.random());
    setSessionQuestions(shuffled.slice(0, parsedConfig.questionsCount));
    
    // Initial prep time
    setTimeLeft(parsedConfig.prepTime);
    isInitialized.current = true;
  }, [navigate]);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (status !== 'completed' && timeLeft > 0) {
      timer = setInterval(() => {
        setTimeLeft((prev) => prev - 1);
      }, 1000);
    } else if (timeLeft === 0 && status !== 'completed') {
      if (status === 'preparing') {
        handleStartAnswering();
      } else if (status === 'answering') {
        handleNextQuestion();
      }
    }
    return () => clearInterval(timer);
  }, [timeLeft, status]);

  const handleStartAnswering = () => {
    if (config) {
      setStatus('answering');
      setTimeLeft(config.answerTime);
    }
  };

  const handleNextQuestion = () => {
    if (config) {
      if (currentQuestionIndex + 1 < config.questionsCount) {
        setCurrentQuestionIndex(currentQuestionIndex + 1);
        setStatus('preparing');
        setTimeLeft(config.prepTime);
      } else {
        setStatus('completed');
      }
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  if (!config || sessionQuestions.length === 0) return null;

  const currentQuestion = sessionQuestions[currentQuestionIndex];
  const progress = ((currentQuestionIndex) / config.questionsCount) * 100;
  const subProgress = status === 'preparing' 
    ? (1 - timeLeft / config.prepTime) * 100 
    : (1 - timeLeft / config.answerTime) * 100;

  if (status === 'completed') {
    return (
      <MainLayout>
        <div className="p-4 md:p-8 max-w-4xl mx-auto text-center space-y-12 py-20 animate-fade-in">
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.5 }}
            className="inline-flex h-24 w-24 items-center justify-center rounded-full bg-green-500/20 mb-4"
          >
            <CheckCircle2 className="h-12 w-12 text-green-500 shadow-glow" />
          </motion.div>
          <div className="space-y-4">
            <h1 className="text-4xl font-extrabold tracking-tight">Practice Complete!</h1>
            <p className="text-muted-foreground text-lg max-w-lg mx-auto leading-relaxed">
              You've successfully handled {config.questionsCount} speaking prompts. Your dedication to building self-expression is paying off.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-8">
            <Card className="bg-card border-border py-8">
              <CardTitle className="text-4xl font-bold text-primary mb-2">{config.questionsCount}</CardTitle>
              <CardDescription className="text-xs uppercase font-bold tracking-widest">Questions Handled</CardDescription>
            </Card>
            <Card className="bg-card border-border py-8">
              <CardTitle className="text-4xl font-bold text-cyan-500">{formatTime(config.prepTime * config.questionsCount)}</CardTitle>
              <CardDescription className="text-xs uppercase font-bold tracking-widest">Preparation Time</CardDescription>
            </Card>
            <Card className="bg-card border-border py-8">
              <CardTitle className="text-4xl font-bold text-green-500">{formatTime(config.answerTime * config.questionsCount)}</CardTitle>
              <CardDescription className="text-xs uppercase font-bold tracking-widest">Response Time</CardDescription>
            </Card>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-12">
             <Button 
                size="lg" 
                variant="outline" 
                className="rounded-full px-8 gap-2 border-border hover:bg-secondary h-14"
                onClick={() => navigate('/custom-practice')}
              >
                <RotateCcw className="h-5 w-5" />
                Start New Configuration
              </Button>
              <Button 
                size="lg" 
                className="rounded-full px-8 gap-2 bg-primary text-primary-foreground font-bold h-14 shadow-lg shadow-primary/20"
                onClick={() => navigate('/dashboard')}
              >
                <LayoutDashboard className="h-5 w-5" />
                Back to Dashboard
              </Button>
          </div>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="min-h-screen p-4 md:p-8 flex flex-col items-center justify-center gap-8 max-w-5xl mx-auto overflow-hidden">
        {/* Global Progress Bar */}
        <div className="w-full space-y-2 mb-8 animate-fade-in">
           <div className="flex justify-between items-center text-xs font-bold uppercase tracking-widest text-muted-foreground">
              <span>Overall Progress</span>
              <span>Question {currentQuestionIndex + 1} of {config.questionsCount}</span>
           </div>
           <Progress value={progress} className="h-1.5 bg-secondary" />
        </div>

        {/* Main Content Area */}
        <AnimatePresence mode="wait">
          <motion.div
            key={currentQuestionIndex + status}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.4 }}
            className="w-full flex flex-col gap-8"
          >
            {/* Question Card */}
            <Card className="bg-card border-border backdrop-blur-2xl p-8 md:p-12 relative overflow-hidden group">
               <div className="absolute top-0 right-0 p-8 opacity-5">
                  <MessageSquare className="h-32 w-32" />
               </div>
               <div className="flex flex-col items-center text-center space-y-8 relative z-10">
                  <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary mb-2 shadow-[0_0_20px_rgba(139,92,246,0.1)]">
                     <Sparkles className="h-6 w-6" />
                  </div>
                  <h2 className="text-2xl md:text-4xl font-extrabold leading-tight tracking-tight px-4 min-h-[120px] flex items-center">
                    {currentQuestion}
                  </h2>
               </div>
            </Card>

            {/* Timer and Status Area */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-stretch">
               <Card className={cn(
                  "border-2 transition-all duration-500 overflow-hidden",
                  status === 'preparing' ? "border-cyan-500/50 bg-cyan-500/5 shadow-[0_0_30px_rgba(6,182,212,0.1)]" : "border-border opacity-40 grayscale"
               )}>
                  <CardHeader className="pb-4 border-b border-border">
                     <div className="flex items-center gap-2">
                        <Timer className="h-4 w-4 text-cyan-500" />
                        <CardTitle className="text-sm font-bold uppercase tracking-widest">Preparation Phase</CardTitle>
                     </div>
                  </CardHeader>
                  <CardContent className="pt-8 flex flex-col items-center gap-6">
                     <div className="text-6xl font-black font-mono text-cyan-500 drop-shadow-[0_0_10px_rgba(6,182,212,0.3)]">
                        {status === 'preparing' ? formatTime(timeLeft) : '---'}
                     </div>
                     <Progress value={status === 'preparing' ? (timeLeft / config.prepTime) * 100 : 0} className="h-1 bg-secondary" />
                     {status === 'preparing' && (
                        <Button 
                          variant="outline" 
                          className="w-full rounded-full border-cyan-500/20 text-cyan-500 hover:bg-cyan-500/10 gap-2 h-11"
                          onClick={handleStartAnswering}
                        >
                          Skip Prep <ArrowRight className="h-4 w-4" />
                        </Button>
                     )}
                  </CardContent>
               </Card>

               <Card className={cn(
                  "border-2 transition-all duration-500 overflow-hidden",
                  status === 'answering' ? "border-green-500/50 bg-green-500/5 shadow-[0_0_30px_rgba(34,197,94,0.1)]" : "border-border opacity-40 grayscale"
               )}>
                  <CardHeader className="pb-4 border-b border-border">
                     <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4 text-green-500" />
                        <CardTitle className="text-sm font-bold uppercase tracking-widest">Response Phase</CardTitle>
                     </div>
                  </CardHeader>
                  <CardContent className="pt-8 flex flex-col items-center gap-6">
                     <div className="text-6xl font-black font-mono text-green-500 drop-shadow-[0_0_10px_rgba(34,197,94,0.3)]">
                        {status === 'answering' ? formatTime(timeLeft) : '---'}
                     </div>
                     <Progress value={status === 'answering' ? (timeLeft / config.answerTime) * 100 : 0} className="h-1 bg-secondary" />
                     {status === 'answering' && (
                        <Button 
                          className="w-full rounded-full bg-green-600 hover:bg-green-500 text-white font-bold gap-2 h-11"
                          onClick={handleNextQuestion}
                        >
                          Next Question <ChevronRight className="h-4 w-4" />
                        </Button>
                     )}
                  </CardContent>
               </Card>
            </div>
          </motion.div>
        </AnimatePresence>

        {/* Footer Info */}
        <div className="flex items-center gap-4 text-xs font-bold tracking-widest uppercase text-muted-foreground animate-fade-in py-8">
           <AlertTriangle className="h-4 w-4 text-yellow-500/50" />
           <span>Session is active. Do not refresh this page.</span>
        </div>
      </div>
    </MainLayout>
  );
}
