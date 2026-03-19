import React, { useState, useEffect, useRef } from 'react';
import { 
  Mic, 
  MicOff, 
  Video as VideoIcon, 
  VideoOff, 
  PhoneOff, 
  Play, 
  Zap, 
  Target, 
  TrendingUp, 
  MessageSquare,
  Clock,
  Sparkles,
  ChevronLeft,
  Activity,
  Radio
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';

const transcripts = [
  { role: 'coach', text: "Welcome to your Pitch Coach session. I'm Alex, your AI guide. Are you ready to practice your startup pitch?" },
  { role: 'user', text: "Yes, I'm ready. I've been working on my opening hook." },
  { role: 'coach', text: "Great! Remember to focus on your clarity and pace today. Whenever you're ready, start with your opening statement." },
  { role: 'user', text: "Imagine a world where every student has a personal mentor available 24/7. That's the vision behind VoiceForge..." },
  { role: 'coach', text: "Excellent hook. Your confidence score just went up! Keep going, but try to slow down slightly during the vision statement." },
];

export default function LiveSession() {
  const navigate = useNavigate();
  const [isSessionActive, setIsSessionActive] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOn, setIsVideoOn] = useState(true);
  const [timer, setTimer] = useState(0);
  const [currentTranscripts, setCurrentTranscripts] = useState<typeof transcripts>([]);
  const transcriptEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isSessionActive) {
      interval = setInterval(() => {
        setTimer((prev) => prev + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isSessionActive]);

  useEffect(() => {
    if (isSessionActive && currentTranscripts.length < transcripts.length) {
      const timeout = setTimeout(() => {
        setCurrentTranscripts(prev => [...prev, transcripts[prev.length]]);
      }, 3000);
      return () => clearTimeout(timeout);
    }
  }, [isSessionActive, currentTranscripts]);

  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [currentTranscripts]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleEndSession = () => {
    setIsSessionActive(false);
    navigate('/results');
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Top Bar */}
      <div className="border-b border-border bg-card/50 backdrop-blur-xl sticky top-0 z-50">
        <div className="container mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link to="/scenarios">
              <Button variant="ghost" size="icon" className="rounded-full" onClick={() => {}}>
                <ChevronLeft className="h-5 w-5" />
              </Button>
            </Link>
            <div>
              <h2 className="font-semibold">Pitch Coach Session</h2>
              <p className="text-xs text-muted-foreground">Intermediate • 15m</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-sm font-mono">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <span className="font-semibold">{formatTime(timer)}</span>
            </div>
            {isSessionActive && (
              <Badge variant="secondary" className="bg-emerald-400/10 text-emerald-400 border-emerald-400/20 gap-2">
                <Radio className="h-3 w-3 animate-pulse" />
                Live
              </Badge>
            )}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 container mx-auto p-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - AI Coach & Transcript */}
        <div className="lg:col-span-2 space-y-6">
          {/* AI Coach Status */}
          <Card className="border-border bg-card overflow-hidden">
            <CardHeader className="border-b border-border pb-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="relative">
                    <div className="h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center">
                      <Sparkles className="h-7 w-7 text-primary" />
                    </div>
                    {isSessionActive && (
                      <motion.div
                        className="absolute inset-0 rounded-full border-2 border-primary"
                        animate={{ scale: [1, 1.2, 1], opacity: [0.5, 0, 0.5] }}
                        transition={{ duration: 2, repeat: Infinity }}
                      />
                    )}
                  </div>
                  <div>
                    <CardTitle className="text-xl">AI Coach: Alex</CardTitle>
                    <p className="text-sm text-muted-foreground font-light">
                      {isSessionActive ? 'Listening and analyzing...' : 'Ready to begin'}
                    </p>
                  </div>
                </div>
                <Badge variant="outline" className="text-primary border-primary/20">
                  Voice Active
                </Badge>
              </div>
            </CardHeader>
          </Card>

          {/* Live Transcript */}
          <Card className="border-border bg-card flex-1">
            <CardHeader className="border-b border-border pb-4">
              <div className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5 text-primary" />
                <CardTitle className="text-lg">Live Transcript</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <ScrollArea className="h-[400px] p-6">
                <div className="space-y-6">
                  <AnimatePresence>
                    {currentTranscripts.map((transcript, idx) => (
                      <motion.div
                        key={idx}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.4 }}
                        className={`flex gap-4 ${transcript.role === 'user' ? 'flex-row-reverse' : ''}`}
                      >
                        <div className={`h-10 w-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                          transcript.role === 'coach' ? 'bg-primary/10' : 'bg-secondary'
                        }`}>
                          {transcript.role === 'coach' ? (
                            <Sparkles className="h-5 w-5 text-primary" />
                          ) : (
                            <span className="text-sm font-semibold">You</span>
                          )}
                        </div>
                        <div className={`flex-1 p-4 rounded-2xl ${
                          transcript.role === 'coach' 
                            ? 'bg-card border border-border' 
                            : 'bg-primary/10 border border-primary/20'
                        }`}>
                          <p className="text-sm leading-relaxed font-light">{transcript.text}</p>
                        </div>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                  <div ref={transcriptEndRef} />
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </div>

        {/* Right Column - Metrics & Camera */}
        <div className="space-y-6">
          {/* Camera Panel */}
          <Card className="border-border bg-card">
            <CardHeader className="border-b border-border pb-4">
              <CardTitle className="text-sm font-medium">Camera Feed</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="aspect-video bg-secondary/50 flex items-center justify-center relative overflow-hidden">
                {isVideoOn ? (
                  <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent" />
                ) : (
                  <VideoOff className="h-12 w-12 text-muted-foreground" />
                )}
                <div className="absolute bottom-4 left-4 right-4 flex justify-center gap-2">
                  <Badge variant="secondary" className="bg-background/80 backdrop-blur-sm">
                    Optional
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Speaking Metrics */}
          <Card className="border-border bg-card">
            <CardHeader className="border-b border-border pb-4">
              <div className="flex items-center gap-2">
                <Activity className="h-5 w-5 text-primary" />
                <CardTitle className="text-lg">Speaking Metrics</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="pt-6 space-y-6">
              <div className="space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <Zap className="h-4 w-4 text-cyan-400" />
                    <span className="font-medium">Clarity</span>
                  </div>
                  <span className="font-semibold">82%</span>
                </div>
                <Progress value={82} className="h-2" />
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <Target className="h-4 w-4 text-emerald-400" />
                    <span className="font-medium">Confidence</span>
                  </div>
                  <span className="font-semibold">78%</span>
                </div>
                <Progress value={78} className="h-2" />
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-violet-400" />
                    <span className="font-medium">Pace</span>
                  </div>
                  <span className="font-semibold">Good</span>
                </div>
                <Progress value={70} className="h-2" />
              </div>

              <div className="pt-4 border-t border-border">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Filler Words</span>
                  <span className="font-semibold">3</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Bottom Control Bar */}
      <div className="border-t border-border bg-card/50 backdrop-blur-xl sticky bottom-0">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-center gap-4">
            <Button
              variant="outline"
              size="icon"
              className={`h-12 w-12 rounded-full ${isMuted ? 'bg-destructive/10 border-destructive/20 text-destructive' : ''}`}
              onClick={() => setIsMuted(!isMuted)}
            >
              {isMuted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
            </Button>

            <Button
              variant="outline"
              size="icon"
              className={`h-12 w-12 rounded-full ${!isVideoOn ? 'bg-destructive/10 border-destructive/20 text-destructive' : ''}`}
              onClick={() => setIsVideoOn(!isVideoOn)}
            >
              {isVideoOn ? <VideoIcon className="h-5 w-5" /> : <VideoOff className="h-5 w-5" />}
            </Button>

            {!isSessionActive ? (
              <Button
                size="lg"
                className="h-14 px-10 rounded-full font-semibold glow-accent-strong"
                onClick={() => setIsSessionActive(true)}
              >
                <Play className="h-5 w-5 mr-2 fill-current" />
                Start Session
              </Button>
            ) : (
              <Button
                size="lg"
                variant="destructive"
                className="h-14 px-10 rounded-full font-semibold"
                onClick={handleEndSession}
              >
                <PhoneOff className="h-5 w-5 mr-2" />
                End Session
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
