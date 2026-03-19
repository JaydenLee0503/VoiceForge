import React, { useState } from 'react';
import { MainLayout } from '@/components/layouts/MainLayout';
import { 
  PlusCircle, 
  Settings2, 
  Clock, 
  Play, 
  HelpCircle,
  Timer,
  ChevronRight
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';

export default function CustomPracticeConfig() {
  const navigate = useNavigate();
  const [questionsCount, setQuestionsCount] = useState(5);
  const [prepTime, setPrepTime] = useState(60); // seconds
  const [answerTime, setAnswerTime] = useState(120); // seconds

  const handleStartSession = () => {
    // Save configuration to localStorage to be accessed by the session page
    const config = {
      questionsCount,
      prepTime,
      answerTime
    };
    localStorage.setItem('customPracticeConfig', JSON.stringify(config));
    navigate('/custom-practice/session');
  };

  const formatTime = (seconds: number) => {
    if (seconds < 60) return `${seconds}s`;
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return secs === 0 ? `${mins}m` : `${mins}m ${secs}s`;
  };

  return (
    <MainLayout>
      <div className="p-4 md:p-8 max-w-4xl mx-auto space-y-8 animate-fade-in">
        <div className="flex items-center gap-4 mb-8">
          <div className="h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
            <PlusCircle className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-4xl font-bold tracking-tight mb-1">Custom Practice</h1>
            <p className="text-muted-foreground">Configure your own tailored speaking rehearsal session.</p>
          </div>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <Card className="bg-card border-border backdrop-blur-xl overflow-hidden">
            <CardHeader className="border-b border-border pb-6">
              <div className="flex items-center gap-2 text-primary mb-1">
                <Settings2 className="h-4 w-4" />
                <span className="text-xs font-bold uppercase tracking-widest">Session Configuration</span>
              </div>
              <CardTitle className="text-xl">Practice Parameters</CardTitle>
              <CardDescription>
                Set the structure for your personalized speaking session.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-12 py-8">
              {/* Number of Questions */}
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <HelpCircle className="h-4 w-4 text-primary" />
                    <Label className="text-base font-semibold">Number of Practice Questions</Label>
                  </div>
                  <span className="text-2xl font-bold text-primary">{questionsCount}</span>
                </div>
                <Slider
                  value={[questionsCount]}
                  onValueChange={(vals) => setQuestionsCount(vals[0])}
                  min={1}
                  max={20}
                  step={1}
                  className="py-4"
                />
                <p className="text-xs text-muted-foreground">How many unique speaking prompts would you like to handle?</p>
              </div>

              {/* Prep Time */}
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Timer className="h-4 w-4 text-cyan-500" />
                    <Label className="text-base font-semibold">Preparation Time Per Question</Label>
                  </div>
                  <span className="text-2xl font-bold text-cyan-500">{formatTime(prepTime)}</span>
                </div>
                <Slider
                  value={[prepTime]}
                  onValueChange={(vals) => setPrepTime(vals[0])}
                  min={10}
                  max={300}
                  step={10}
                  className="py-4"
                />
                <p className="text-xs text-muted-foreground">Review and brainstorm before your formal response begins.</p>
              </div>

              {/* Answer Time */}
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-green-500" />
                    <Label className="text-base font-semibold">Answer Time Per Question</Label>
                  </div>
                  <span className="text-2xl font-bold text-green-500">{formatTime(answerTime)}</span>
                </div>
                <Slider
                  value={[answerTime]}
                  onValueChange={(vals) => setAnswerTime(vals[0])}
                  min={30}
                  max={600}
                  step={30}
                  className="py-4"
                />
                <p className="text-xs text-muted-foreground">The formal countdown for your recorded or performed answer.</p>
              </div>
            </CardContent>
            <CardFooter className="bg-secondary border-t border-border p-6 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-6 text-sm">
                <div className="flex flex-col">
                  <span className="text-muted-foreground uppercase text-[10px] font-bold tracking-wider">Estimated Total</span>
                  <span className="font-bold text-lg">{formatTime(questionsCount * (prepTime + answerTime))}</span>
                </div>
              </div>
              <Button 
                size="lg" 
                className="w-full sm:w-auto px-12 rounded-full font-bold shadow-lg shadow-primary/20 gap-2 h-14 text-lg"
                onClick={handleStartSession}
              >
                <Play className="h-5 w-5 fill-current" />
                Start Session
                <ChevronRight className="h-5 w-5" />
              </Button>
            </CardFooter>
          </Card>
        </motion.div>
      </div>
    </MainLayout>
  );
}
