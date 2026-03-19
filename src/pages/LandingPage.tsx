import React from 'react';
import { Link } from 'react-router-dom';
import { 
  Mic2, 
  Sparkles, 
  TrendingUp, 
  Video, 
  ArrowRight, 
  Github,
  Twitter,
  Linkedin,
  Monitor,
  Zap,
  Target
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { motion } from 'framer-motion';

const benefits = [
  {
    icon: Sparkles,
    title: "Real-time AI Coaching",
    description: "Instant feedback on tone, clarity, and confidence as you speak."
  },
  {
    icon: TrendingUp,
    title: "Progress Tracking",
    description: "Watch your confidence scores grow with every session."
  },
  {
    icon: Target,
    title: "Scenario-based Practice",
    description: "From high-stakes pitches to everyday conversations."
  }
];

const scenarios = [
  { title: "Pitch Coach", description: "Refine your delivery for presentations and startup pitches." },
  { title: "Interview Practice", description: "Ace your next job interview with tailored mock sessions." },
  { title: "Everyday Confidence", description: "Improve your daily interactions and self-expression." }
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Navigation */}
      <nav className="fixed top-0 w-full z-50 bg-background/80 backdrop-blur-xl border-b border-border">
        <div className="container mx-auto px-6 h-16 flex items-center justify-between">
          <Link to="/dashboard" className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-xl bg-primary/10 flex items-center justify-center">
              <Mic2 className="h-4 w-4 text-primary" />
            </div>
            <span className="text-lg font-semibold tracking-tight">VoiceForge</span>
          </Link>
          <div className="hidden md:flex items-center gap-8 text-sm font-medium text-muted-foreground">
            <a href="#features" className="hover:text-foreground transition-colors">Features</a>
            <a href="#scenarios" className="hover:text-foreground transition-colors">Scenarios</a>
            <a href="#about" className="hover:text-foreground transition-colors">About</a>
          </div>
          <div className="flex items-center gap-4">
            <Button variant="ghost" className="hidden sm:inline-flex text-sm" onClick={() => {}}>Sign In</Button>
            <Link to="/dashboard">
              <Button className="text-sm font-medium h-9 px-4" onClick={() => {}}>
                Get Started
              </Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-32 pb-24 px-6 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-primary/5 via-transparent to-transparent pointer-events-none" />
        <div className="container mx-auto text-center relative">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="max-w-4xl mx-auto space-y-8"
          >
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-border bg-card text-sm font-medium mb-4">
              <Sparkles className="h-3.5 w-3.5 text-primary" />
              <span className="text-muted-foreground">AI-Powered Speaking Coach</span>
            </div>
            <h1 className="text-5xl md:text-7xl lg:text-8xl font-bold tracking-tight leading-[1.1]">
              Master Your <br />
              <span className="gradient-text">Speaking Voice</span>
            </h1>
            <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
              Build confidence through real-time AI conversations, clarity analysis, and personalized feedback.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
              <Link to="/dashboard">
                <Button size="lg" className="h-12 px-8 text-base font-medium glow-accent" onClick={() => {}}>
                  Start Practicing
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
              <Button size="lg" variant="outline" className="h-12 px-8 text-base font-medium" onClick={() => {}}>
                Watch Demo
              </Button>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-24 px-6 border-t border-border">
        <div className="container mx-auto">
          <div className="text-center mb-16 max-w-2xl mx-auto">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Elevate Your Presence</h2>
            <p className="text-muted-foreground text-lg">The tools you need to communicate with impact.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {benefits.map((benefit, idx) => (
              <motion.div 
                key={idx}
                whileHover={{ y: -4 }}
                className="p-8 rounded-2xl border border-border bg-card hover:border-primary/50 transition-all"
              >
                <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center mb-6">
                  <benefit.icon className="h-6 w-6 text-primary" />
                </div>
                <h3 className="text-xl font-semibold mb-3">{benefit.title}</h3>
                <p className="text-muted-foreground leading-relaxed">{benefit.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Scenarios Section */}
      <section id="scenarios" className="py-24 px-6 bg-card/30">
        <div className="container mx-auto">
          <div className="flex flex-col md:flex-row items-end justify-between mb-12 gap-8 max-w-5xl mx-auto">
            <div className="max-w-2xl">
              <h2 className="text-3xl md:text-4xl font-bold mb-4">Tailored Scenarios</h2>
              <p className="text-muted-foreground text-lg">Practice in real-world contexts designed for creators and professionals.</p>
            </div>
            <Link to="/scenarios">
              <Button variant="link" className="text-primary p-0 h-auto font-medium" onClick={() => {}}>
                View all scenarios
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {scenarios.map((scenario, idx) => (
              <div key={idx} className="group p-6 rounded-xl border border-border bg-background hover:border-primary/50 transition-all cursor-pointer">
                <h4 className="font-semibold text-lg mb-2 group-hover:text-primary transition-colors">{scenario.title}</h4>
                <p className="text-sm text-muted-foreground leading-relaxed">{scenario.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-16 px-6 border-t border-border bg-background">
        <div className="container mx-auto max-w-5xl">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-12 mb-12">
            <div className="md:col-span-2">
              <div className="flex items-center gap-3 mb-6">
                <div className="h-8 w-8 rounded-xl bg-primary/10 flex items-center justify-center">
                  <Mic2 className="h-4 w-4 text-primary" />
                </div>
                <span className="text-lg font-semibold tracking-tight">VoiceForge</span>
              </div>
              <p className="text-muted-foreground max-w-sm leading-relaxed">
                Empowering the next generation of communicators through AI. Build confidence, refine your voice, and master expression.
              </p>
            </div>
            <div>
              <h5 className="font-semibold mb-4">Product</h5>
              <ul className="space-y-3 text-sm text-muted-foreground">
                <li><a href="#" className="hover:text-foreground transition-colors">Features</a></li>
                <li><a href="#" className="hover:text-foreground transition-colors">Scenarios</a></li>
                <li><a href="#" className="hover:text-foreground transition-colors">Pricing</a></li>
              </ul>
            </div>
            <div>
              <h5 className="font-semibold mb-4">Connect</h5>
              <div className="flex gap-4">
                <Twitter className="h-5 w-5 text-muted-foreground hover:text-primary cursor-pointer transition-colors" />
                <Linkedin className="h-5 w-5 text-muted-foreground hover:text-primary cursor-pointer transition-colors" />
                <Github className="h-5 w-5 text-muted-foreground hover:text-primary cursor-pointer transition-colors" />
              </div>
            </div>
          </div>
          <div className="pt-8 border-t border-border text-sm text-muted-foreground flex flex-col md:flex-row justify-between items-center gap-4">
            <p>© 2026 VoiceForge. All rights reserved.</p>
            <div className="flex gap-8">
              <a href="#" className="hover:text-foreground transition-colors">Privacy</a>
              <a href="#" className="hover:text-foreground transition-colors">Terms</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
