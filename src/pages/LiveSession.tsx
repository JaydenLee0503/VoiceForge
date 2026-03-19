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
  Settings,
  XCircle,
  BarChart2,
  User,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';

const transcripts = [
  { role: 'coach', text: "Welcome to your Pitch Coach session. I'm Alex, your AI guide. Are you ready to practice your startup pitch?" },
  { role: 'user', text: "Yes, I'm ready. I've been working on my opening hook." },
  { role: 'coach', text: "Great! Remember to focus on your clarity and pace today. Whenever you're ready, start with your opening statement." },
  { role: 'user', text: "Imagine a world where every student has a personal mentor available 24/7. That's the vision behind VoiceForge..." },
  { role: 'coach', text: "Excellent hook. Your confidence score just went up! Keep going, but try to slow down slightly during the vision statement." },
];

export default function LiveSession() {
  const { id } = useParams();
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
    <div className="min-h-screen bg-background text-foreground flex flex-col font-sans overflow-hidden">
      {/* Immersive Header */}
      <header className="h-16 border-b bg-card/30 backdrop-blur-xl px-6 flex items-center justify-between z-10">
        <div className="flex items-center gap-4">
          <Link to="/scenarios">
            <Button variant="ghost" size="icon" className="rounded-full" onClick={() => {}}>
              <ChevronLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
              <Mic2 className="h-5 w-5 text-primary-foreground" />
            </div>
            <div className="flex flex-col">
              <span className="font-bold text-sm leading-none">Pitch Coach</span>
              <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-bold mt-1">
                {isSessionActive ? 'In Session' : 'Ready'}
              </span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/5 border border-white/10 font-mono text-sm">
            <Clock className="h-4 w-4 text-primary" />
            {formatTime(timer)}
          </div>
          <Button variant="ghost" size="icon" className="rounded-full" onClick={() => {}}>
            <Settings className="h-5 w-5 text-muted-foreground" />
          </Button>
        </div>
      </header>

      {/* Session Content */}
      <main className="flex-1 flex flex-col md:flex-row p-4 md:p-6 gap-6 overflow-hidden">
        {/* Main Conversation Area */}
        <div className="flex-1 flex flex-col gap-6 min-w-0">
          {/* Coach Status Card */}
          <Card className="bg-card/30 border-white/5 flex flex-col items-center justify-center py-12 relative overflow-hidden group">
            <div className="absolute inset-0 bg-primary/5 opacity-0 group-hover:opacity-100 transition-opacity" />
            {/* Pulsing AI Visualizer */}
            <div className="relative mb-8">
              <div className="h-32 w-32 rounded-full bg-primary/20 flex items-center justify-center relative">
                 <AnimatePresence>
                   {isSessionActive && (
                     <motion.div 
                        initial={{ scale: 0.8, opacity: 0 }}
                        animate={{ scale: [1, 1.3, 1], opacity: [0.3, 0.1, 0.3] }}
                        transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
                        className="absolute inset-0 rounded-full bg-primary/40"
                     />
                   )}
                 </AnimatePresence>
                 <div className="h-24 w-24 rounded-full bg-primary flex items-center justify-center shadow-[0_0_30px_rgba(139,92,246,0.5)] z-10">
                    <Sparkles className="h-10 w-10 text-primary-foreground animate-pulse" />
                 </div>
              </div>
            </div>
            <div className="text-center z-10">
               <h2 className="text-2xl font-bold mb-1">Alex • AI Coach</h2>
               <p className="text-muted-foreground flex items-center justify-center gap-2">
                 {isSessionActive ? (
                   <>
                     <span className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
                     Listening & Analyzing...
                   </>
                 ) : (
                   'Waiting for you to start'
                 )}
               </p>
            </div>
          </Card>

          {/* Live Transcript */}
          <Card className="flex-1 bg-card/30 border-white/5 flex flex-col overflow-hidden">
            <CardHeader className="pb-2 border-b border-white/5 flex flex-row items-center justify-between">
              <div className="flex items-center gap-2">
                <MessageSquare className="h-4 w-4 text-primary" />
                <CardTitle className="text-sm font-bold">Live Transcript</CardTitle>
              </div>
              <Badge variant="outline" className="text-[10px] font-bold tracking-widest uppercase">Beta Feedback</Badge>
            </CardHeader>
            <ScrollArea className="flex-1 p-6">
              <div className="space-y-6">
                <AnimatePresence mode="popLayout">
                  {currentTranscripts.map((t, i) => (
                    <motion.div 
                      key={i}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className={cn(
                        "flex flex-col gap-2 max-w-[85%]",
                        t.role === 'user' ? "ml-auto items-end" : "items-start"
                      )}
                    >
                      <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                        {t.role === 'user' ? 'You' : 'Alex'}
                      </span>
                      <div className={cn(
                        "px-4 py-3 rounded-2xl text-sm leading-relaxed",
                        t.role === 'user' 
                          ? "bg-primary text-primary-foreground rounded-tr-none" 
                          : "bg-white/5 border border-white/10 rounded-tl-none"
                      )}>
                        {t.text}
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
                <div ref={transcriptEndRef} />
                {!isSessionActive && (
                  <div className="text-center py-12 text-muted-foreground">
                    <Mic className="h-8 w-8 mx-auto mb-4 opacity-20" />
                    <p className="text-sm">Transcripts will appear here once the session starts.</p>
                  </div>
                )}
              </div>
            </ScrollArea>
          </Card>
        </div>

        {/* Sidebar: Camera & Metrics */}
        <aside className="w-full md:w-80 flex flex-col gap-6">
          {/* Camera Panel */}
          <Card className="bg-card/50 border-white/5 aspect-video md:aspect-auto md:h-64 flex flex-col items-center justify-center relative overflow-hidden group">
            {isVideoOn ? (
              <div className="w-full h-full bg-slate-900 flex items-center justify-center relative">
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                <User className="h-20 w-20 text-white/10" />
                <div className="absolute bottom-4 left-4 flex items-center gap-2">
                  <Badge className="bg-primary/20 text-primary border-primary/20 backdrop-blur-md">Your Camera</Badge>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-3 text-muted-foreground">
                <div className="h-16 w-16 rounded-full bg-white/5 flex items-center justify-center">
                  <VideoOff className="h-8 w-8" />
                </div>
                <p className="text-xs font-medium">Camera is disabled</p>
              </div>
            )}
            <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
              <Button size="icon" variant="ghost" className="h-8 w-8 rounded-full bg-black/40 backdrop-blur-md" onClick={() => {}}>
                <Expand className="h-4 w-4" />
              </Button>
            </div>
          </Card>

          {/* Live Metrics */}
          <Card className="flex-1 bg-card/30 border-white/5 flex flex-col">
            <CardHeader className="pb-4">
              <div className="flex items-center gap-2">
                <BarChart2 className="h-4 w-4 text-primary" />
                <CardTitle className="text-sm font-bold">Live Metrics</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              <MetricItem label="Clarity" value={75} color="bg-cyan-500" icon={Zap} />
              <MetricItem label="Confidence" value={82} color="bg-green-500" icon={Target} />
              <MetricItem label="Pace" value={90} color="bg-primary" icon={TrendingUp} />
              
              <div className="pt-4 border-t border-white/5 space-y-4">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-muted-foreground font-medium uppercase tracking-wider">Filler Words</span>
                  <Badge variant="destructive" className="h-5 px-1.5 font-bold">3</Badge>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="outline" className="text-[10px] border-white/5 bg-white/5">Um (2)</Badge>
                  <Badge variant="outline" className="text-[10px] border-white/5 bg-white/5">Like (1)</Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        </aside>
      </main>

      {/* Control Bar */}
      <div className="h-24 border-t bg-card/30 backdrop-blur-xl px-6 flex items-center justify-center gap-4 z-10">
        <Button 
          variant="outline" 
          size="icon" 
          className={cn(
            "h-12 w-12 rounded-full border-white/10 transition-all",
            isMuted && "bg-destructive/20 border-destructive/50 text-destructive hover:bg-destructive/30"
          )}
          onClick={() => setIsMuted(!isMuted)}
        >
          {isMuted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
        </Button>
        <Button 
          variant="outline" 
          size="icon" 
          className={cn(
            "h-12 w-12 rounded-full border-white/10 transition-all",
            !isVideoOn && "bg-destructive/20 border-destructive/50 text-destructive hover:bg-destructive/30"
          )}
          onClick={() => setIsVideoOn(!isVideoOn)}
        >
          {isVideoOn ? <VideoIcon className="h-5 w-5" /> : <VideoOff className="h-5 w-5" />}
        </Button>
        
        {!isSessionActive ? (
          <Button 
            size="lg" 
            className="rounded-full px-8 h-12 bg-primary text-primary-foreground font-bold shadow-[0_0_20px_rgba(139,92,246,0.4)]"
            onClick={() => setIsSessionActive(true)}
          >
            <Play className="mr-2 h-5 w-5 fill-current" />
            Start Session
          </Button>
        ) : (
          <Button 
            size="lg" 
            className="rounded-full px-8 h-12 bg-white text-black hover:bg-white/90 font-bold"
            onClick={handleEndSession}
          >
            <PhoneOff className="mr-2 h-5 w-5" />
            End Session
          </Button>
        )}

        <Button variant="outline" size="icon" className="h-12 w-12 rounded-full border-white/10" onClick={() => {}}>
          <Settings className="h-5 w-5" />
        </Button>
      </div>
    </div>
  );
}

function MetricItem({ label, value, color, icon: Icon }: any) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-xs font-medium uppercase tracking-wider">
        <div className="flex items-center gap-1.5 text-muted-foreground">
          <Icon className="h-3 w-3" />
          {label}
        </div>
        <span>{value}%</span>
      </div>
      <Progress value={value} className="h-1.5 bg-white/5" />
    </div>
  );
}

function Expand(props: any) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="m15 3 6 6" />
      <path d="m9 21-6-6" />
      <path d="M21 3v6h-6" />
      <path d="M3 21v-6h6" />
    </svg>
  );
}

function Mic2(props: any) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
      <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
      <line x1="12" x2="12" y1="19" y2="22" />
    </svg>
  );
}

function cn(...inputs: any[]) {
  return inputs.filter(Boolean).join(' ');
}
