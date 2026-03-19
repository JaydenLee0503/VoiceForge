# VoiceForge Requirements Document

## 1. Application Overview

### 1.1 Application Name
VoiceForge

### 1.2 Application Description
VoiceForge is a premium AI-powered speaking coach designed for students, creators, founders, and builders who want to improve their confidence, clarity, and self-expression through real-time AI conversations. The application provides a polished, high-end UI focused on speaking practice, feedback, and progress tracking with a futuristic, calm, and intelligent aesthetic.

### 1.3 Application Type
Web application with a premium, futuristic design aesthetic

## 2. Visual Design System

### 2.1 Theme Modes
- Dark Mode (default):
  - Base: Deep charcoal or deep navy
  - Accents: Subtle electric blue or violet
  - Minimal glow effects used only where they add meaning
  - Strong contrast between primary and secondary content
- Light Mode:
  - Base: Clean white or light gray
  - Accents: Refined blue or violet tones
  - Maintains premium aesthetic with appropriate contrast
  - Consistent visual language with dark mode
- Theme toggle button positioned at the bottom of navigation, below Sign out button

### 2.2 Color Palette
- Dark Mode:
  - Base: Deep charcoal or deep navy
  - Accents: Subtle electric blue or violet
  - Minimal glow effects used only where they add meaning
  - Strong contrast between primary and secondary content
- Light Mode:
  - Base: Clean white or light gray
  - Accents: Refined blue or violet tones
  - Maintains premium aesthetic with appropriate contrast

### 2.3 Design Principles
- Support for both dark and light themes
- Clean, spacious layout with thoughtful, deliberate spacing
- Larger typography hierarchy
- Elegant panels with soft borders
- Rounded corners, but not oversized
- More refined and premium than playful
- Avoid clutter, overusing gradients, glassmorphism, or cartoonish icons
- Avoid generic startup dashboard or SaaS look
- Voice-first interface aesthetic
- Futuristic mission control inspiration
- Expressive through motion and audio-inspired shapes, not visual chaos

### 2.4 Typography
- Strong hierarchy with larger primary text
- Clean, modern, professional fonts
- Improved readability through better contrast and spacing
- Consistent across both theme modes

### 2.5 Component Styling
- Elegant panels with soft borders
- Refined card designs
- Premium, polished visual treatment
- Consistent visual language across all components
- Adaptive styling for both dark and light modes

## 3. Core Features

### 3.1 Landing Page
- Premium hero section with emotionally strong presence
- App name: VoiceForge
- Stronger headline hierarchy with more breathing room
- Clean visual motif related to voice, sound waves, conversation, or expression
- Headline and subheadline introducing the speaking coach concept
- Primary CTA button: Start Practicing (sharper and more intentional design)
- Secondary CTA button: See Demo
- Explanation section describing VoiceForge's purpose
- Key benefits section highlighting:
  - Real-time AI conversation practice
  - Speaking feedback
  - Confidence tracking
  - Optional camera-based presence analysis
- Scenario examples section featuring:
  - Pitch Coach
  - Interview Practice
  - Everyday Confidence
- Footer

### 3.2 Dashboard
- Welcome header
- Elegant stat cards displaying:
  - Sessions completed
  - Current streak
  - Confidence score
  - Clarity score
- Product-specific design that feels like an AI speaking tool, not a school portal
- Better spacing and alignment throughout
- Continue Practicing card
- Today's Focus card
- Recent sessions list with improved visual hierarchy
- Scenario shortcuts
- Weekly progress chart placeholder
- Badge/progress section placeholder

### 3.3 Scenario Picker
- Grid layout of immersive and polished scenario cards
- Each card includes:
  - Title
  - Short description
  - Difficulty level (visually clean presentation)
  - Estimated time (visually clean presentation)
- Improved card hierarchy
- Available scenarios:
  - Pitch Coach
  - Interview Practice
  - Small Talk
  - Asking for Help
  - Defending an Idea
  - Telling Your Story
- Filter tabs/category pills with subtle distinction:
  - Everyday Confidence
  - High-Stakes Speaking
  - Expression & Identity
- Curated and intentional page feel

### 3.4 Custom Practice Mode

#### 3.4.1 Configuration Screen
- Parameter configuration panel with three user-controlled settings:
  - Number of Practice Questions: Input field or selector for total question quantity (e.g., 5, 10, 20)
  - Preparation Time Per Question: Input field or selector for prep countdown timer (e.g., 30 seconds, 1 minute, 2 minutes)
  - Answer Time Per Question: Input field or selector for answer countdown timer (e.g., 1 minute, 90 seconds, 3 minutes)
- Start Practice button to initiate session

#### 3.4.2 Practice Session Workflow
- Step 1: Display configured parameters summary
- Step 2: Present randomly generated practice question
- Step 3: Display Prep Time countdown timer
- Step 4: Automatically transition to Answer Time countdown when Prep Time expires
- Step 5: Allow manual answer submission or automatic progression when Answer Time expires
- Step 6: Proceed to next question, repeating Steps 2-5
- Step 7: End session after specified number of questions completed

#### 3.4.3 Practice Session Screen
- Question display area
- Countdown timer display showing:
  - Current phase (Prep Time / Answer Time)
  - Remaining time
- Progress indicator showing current question number and total questions
- Manual submit button for early answer submission
- Session controls:
  - Pause Session
  - End Session Early

### 3.5 Live Session Screen
- Real-time AI speaking cockpit aesthetic
- Strong focal area for the conversation
- Main conversation panel
- AI coach status card showing:
  - Coach name
  - Voice status
  - Current scenario
- Live transcript panel with voice-driven feel
- Camera/presence panel as premium optional coaching tool
- Clean, modern, high-priority session controls:
  - Start Session
  - End Session
  - Mute
  - Camera Toggle
- Speaking metrics sidebar displaying:
  - Clarity
  - Confidence
  - Pace
  - Filler words
- Readable and useful metrics presentation, not crowded
- Emphasis on clarity, voice interaction, and presence

### 3.6 Results Page
- Rewarding and premium end-of-session summary screen
- Improved score card layout for:
  - Clarity
  - Confidence
  - Pace
  - Eye Contact
  - Filler Words
- Three insightful and polished feedback cards:
  - Best Moment
  - Improvement Area
  - Next Challenge
- Stronger visual hierarchy between scores, insights, and actions
- Transcript summary placeholder
- Action buttons:
  - Retry Session
  - Back to Dashboard
  - Try Another Scenario

### 3.7 Session History Page
- Cleaner list design of previous speaking sessions
- Each session item displays:
  - Scenario
  - Date
  - Duration
  - Confidence score
  - Clarity score
- More refined filtering or search bar
- Better readability
- Premium detail drawer or modal for reviewing individual sessions

### 3.8 Navigation and Theme Controls
- Navigation sidebar or top navigation for logged-in pages
- Sign out button
- Theme mode toggle button positioned at the bottom of navigation, below Sign out button
- Theme toggle switches between dark mode and light mode
- Theme preference persists across sessions

## 4. Reusable UI Components

### 4.1 Navigation Components
- Navbar with premium styling
- Sidebar or top navigation for logged-in pages
- Theme mode toggle button (positioned below Sign out button)
- Sign out button

### 4.2 Content Components
- Scenario cards (immersive and polished)
- Stat cards (elegant and product-specific)
- Transcript bubbles (live and voice-driven feel)
- Session control bar (clean, modern, high priority)
- Score cards (improved layout)
- Progress chart placeholder
- Badge cards
- Empty state for no sessions
- Parameter configuration inputs
- Countdown timer display
- Progress indicator
- AI coach status card (premium design)

### 4.3 Theme-Adaptive Components
- All components must support both dark and light mode
- Consistent visual language across theme modes
- Smooth transitions between theme changes

## 5. Design Tone and Feel

### 5.1 Overall Aesthetic
- Premium AI speaking coach
- Futuristic, calm, intelligent, and expressive
- Serious and polished, not childish
- Slightly gamified, but not game-like
- Modern and high-end, not generic SaaS
- Closer to a premium AI communication product than a general productivity dashboard
- Consistent premium feel across both dark and light modes

### 5.2 Tone and Copy Direction
- Calm
- Intelligent
- Encouraging and motivating
- Premium
- Expressive
- Focused
- Smart and professional
- Concise text
- Avoid corporate buzzwords
- Human and approachable language
- Target audience: students, creators, founders, and builders

## 6. Technical Constraints

### 6.1 Scope Limitations
- UI skeleton and prototype only
- No real backend logic implementation
- No authentication system
- No database integration
- No API integrations
- No placeholder features unrelated to speaking coaching
- Question generation mechanism is unspecified and out of scope for this design task

### 6.2 Implementation Focus
- Strong frontend skeleton structure
- Reusable and visually consistent components
- Prepared for future integration with backend logic
- Clean code architecture for scalability
- Investor-demo quality polish
- Strong typography, visual calm, clean spacing
- High-end real-time voice interface aesthetic
- Theme mode switching functionality
- Theme preference persistence