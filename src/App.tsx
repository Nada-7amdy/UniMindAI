import React, { useState, useEffect, useRef } from 'react';
import { Send, Book, Bell, Settings, User, LogOut, ChevronRight, Zap, GraduationCap, X, BarChart3, Clock, AlertTriangle, Info, TrendingUp, Users, ShieldAlert, CheckCircle, Plus, Calendar } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Legend } from 'recharts';
import { io } from 'socket.io-client';
import { initGoogleAuth, googleSignIn, getGoogleAccessToken, fetchCalendarEvents } from './lib/googleApi';

type Message = {
  id: string;
  text: string;
  sender: 'user' | 'bot';
  timestamp: Date;
};

type Notification = {
  id: string;
  title: string;
  message: string;
  time: string;
  read: boolean;
  type: 'urgent' | 'routine';
};

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState<{name: string, email: string, role: string} | null>(null);
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    const savedToken = localStorage.getItem('token');
    const savedUser = localStorage.getItem('user');
    if (savedToken && savedUser) {
      setUser(JSON.parse(savedUser));
      setIsAuthenticated(true);
    }
    setIsChecking(false);
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
    setIsAuthenticated(false);
  };

  if (isChecking) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-gray-800 border-t-cyan-500 rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <>
        <AuthPage onLogin={(userData, token) => {
          localStorage.setItem('token', token);
          localStorage.setItem('user', JSON.stringify(userData));
          setUser(userData);
          setIsAuthenticated(true);
        }} />
        <InstallAppPrompt />
      </>
    );
  }

  return (
    <>
      <MainLayout user={user} onLogout={handleLogout} />
      <InstallAppPrompt />
    </>
  );
}

function InstallAppPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    const standaloneMode = window.matchMedia('(display-mode: standalone)').matches;
    const iosStandalone = (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
    setIsInstalled(standaloneMode || iosStandalone);

    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setDeferredPrompt(event as BeforeInstallPromptEvent);
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const choice = await deferredPrompt.userChoice;
    if (choice.outcome === 'accepted') {
      setDeferredPrompt(null);
    }
  };

  if (isInstalled || !deferredPrompt) {
    return null;
  }

  return (
    <button
      onClick={handleInstall}
      className="fixed bottom-5 right-5 z-50 rounded-xl border border-cyan-500/40 bg-gray-900/95 px-4 py-2 text-sm font-semibold text-cyan-300 shadow-lg shadow-cyan-900/40 transition-colors hover:bg-gray-800"
    >
      Install App
    </button>
  );
}

// ----------------------------------------------------------------------
// Auth Page (Cyberpunk / iOS mixed theme)
// ----------------------------------------------------------------------
function AuthPage({ onLogin }: { onLogin: (user: any, token: string) => void }) {
  const [mode, setMode] = useState<'login' | 'signup' | 'forgot'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [studentId, setStudentId] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resetSuccess, setResetSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    if (mode === 'forgot') {
      try {
        const res = await fetch('/api/forgot-password', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email }),
        });
        const data = await res.json();
        if (res.ok) {
          setResetSuccess(true);
        } else {
          setError(data.error || 'Failed to request reset link.');
        }
      } catch (err) {
        setError('Connection error. Please try again.');
      } finally {
        setIsLoading(false);
      }
      return;
    }

    const endpoint = mode === 'login' ? '/api/login' : '/api/register';
    const body = mode === 'login' 
      ? { email, password } 
      : { name, email, studentId, password };

    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (res.ok) {
        onLogin(data.user, data.token);
      } else {
        setError(data.error || 'Authentication failed');
      }
    } catch (err) {
      setError('Connection error. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 flex items-center justify-center p-4 selection:bg-cyan-500/30">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-1/2 -left-1/2 w-full h-full bg-cyan-900/10 blur-[120px] rounded-full"></div>
        <div className="absolute top-1/2 left-1/2 w-full h-full bg-emerald-900/10 blur-[120px] rounded-full"></div>
      </div>
      
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md relative"
      >
        <div className="bg-gray-900/50 backdrop-blur-xl rounded-3xl border border-gray-800 p-8 shadow-2xl">
          <div className="flex justify-center mb-8">
            <div className="w-16 h-16 bg-gradient-to-br from-cyan-400 to-emerald-400 rounded-2xl flex items-center justify-center shadow-lg shadow-cyan-500/20">
              <GraduationCap className="text-gray-950 w-8 h-8" />
            </div>
          </div>
          
          <h1 className="text-2xl font-bold text-center mb-2">
            {mode === 'forgot' ? 'Reset Password' : 'Student Portal'}
          </h1>
          <p className="text-gray-400 text-center text-sm mb-6">
            {mode === 'login' && 'Sign in to access your AI Assistant'}
            {mode === 'signup' && 'Create an account to get started'}
            {mode === 'forgot' && 'Enter your registered email to recover your account'}
          </p>

          {error && (
            <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              {error}
            </div>
          )}

          {resetSuccess ? (
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="space-y-6 text-center"
            >
              <div className="w-16 h-16 bg-emerald-500/10 border border-emerald-500/20 rounded-full flex items-center justify-center mx-auto text-emerald-400">
                <CheckCircle className="w-8 h-8" />
              </div>
              <div className="space-y-2">
                <h3 className="text-lg font-semibold text-gray-100">Check Your Email</h3>
                <p className="text-sm text-gray-400 leading-relaxed px-2">
                  If this email is registered, a password reset link has been sent to your inbox.
                </p>
              </div>
              <button
                onClick={() => {
                  setMode('login');
                  setResetSuccess(false);
                  setError(null);
                }}
                className="w-full bg-gray-950 hover:bg-gray-900 border border-gray-800 text-gray-200 font-semibold rounded-xl px-4 py-3 active:scale-[0.98] transition-all"
              >
                Back to Login
              </button>
            </motion.div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {mode === 'signup' && (
                <>
                  <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}>
                    <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Full Name</label>
                    <input 
                      type="text" 
                      required
                      value={name}
                      onChange={e => setName(e.target.value)}
                      className="w-full bg-gray-950/50 border border-gray-800 rounded-xl px-4 py-3 placeholder-gray-600 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-all text-sm"
                      placeholder="Jane Doe"
                    />
                  </motion.div>
                  <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 }}>
                    <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Student ID</label>
                    <input 
                      type="text" 
                      required
                      value={studentId}
                      onChange={e => setStudentId(e.target.value)}
                      className="w-full bg-gray-950/50 border border-gray-800 rounded-xl px-4 py-3 placeholder-gray-600 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-all font-mono text-sm"
                      placeholder="STU-00000"
                    />
                  </motion.div>
                </>
              )}
              
              <div>
                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Email</label>
                <input 
                  type="email" 
                  required
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className="w-full bg-gray-950/50 border border-gray-800 rounded-xl px-4 py-3 placeholder-gray-600 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-all font-mono text-sm"
                  placeholder="student@university.edu"
                />
              </div>

              {mode !== 'forgot' && (
                <div>
                  <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Password</label>
                  <input 
                    type="password" 
                    required
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    className="w-full bg-gray-950/50 border border-gray-800 rounded-xl px-4 py-3 placeholder-gray-600 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-all font-mono text-sm"
                    placeholder="••••••••"
                  />
                </div>
              )}
              
              <button 
                type="submit" 
                disabled={isLoading}
                className="w-full mt-4 bg-gradient-to-r from-cyan-500 to-emerald-500 text-gray-950 font-semibold rounded-xl px-4 py-3 hover:opacity-90 active:scale-[0.98] transition-all flex justify-center items-center gap-2"
              >
                {isLoading 
                  ? (mode === 'forgot' ? 'Sending...' : 'Verifying...') 
                  : mode === 'login' 
                    ? 'Secure Login' 
                    : mode === 'signup' 
                      ? 'Create Account' 
                      : 'Send Reset Link'
                }
                {!isLoading && <ChevronRight className="w-5 h-5" />}
              </button>
            </form>
          )}

          {!resetSuccess && (
            <div className="mt-8 pt-6 border-t border-gray-800 flex flex-col items-center gap-4">
              {mode === 'forgot' ? (
                <button 
                  onClick={() => {
                    setMode('login');
                    setError(null);
                  }}
                  className="text-sm text-gray-400 hover:text-cyan-400 font-medium transition-colors"
                >
                  Back to Log In
                </button>
              ) : (
                <>
                  <button 
                    onClick={() => {
                      setMode(mode === 'login' ? 'signup' : 'login');
                      setError(null);
                    }}
                    className="text-sm text-gray-400 hover:text-cyan-400 font-medium transition-colors"
                  >
                    {mode === 'login' ? "Don't have an account? Sign Up" : "Already have an account? Log In"}
                  </button>
                  {mode === 'login' && (
                    <button 
                      onClick={() => {
                        setMode('forgot');
                        setError(null);
                      }}
                      className="text-xs text-gray-600 hover:text-gray-400 font-medium transition-colors"
                    >
                      Forgot Password?
                    </button>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}

// ----------------------------------------------------------------------
// Main Application Layout
// ----------------------------------------------------------------------
function MainLayout({ user, onLogout }: { user: any, onLogout: () => void }) {
  const [showNotifications, setShowNotifications] = useState(false);
  const [currentView, setCurrentView] = useState<'chat' | 'analytics' | 'profile' | 'studyPlan' | 'schedule'>('chat');
  const [sessionId, setSessionId] = useState<string | null>(localStorage.getItem('currentSessionId'));
  const [sessions, setSessions] = useState<any[]>([]);
  const [googleUser, setGoogleUser] = useState<any>(null);
  const [googleToken, setGoogleToken] = useState<string | null>(null);

  useEffect(() => {
    initGoogleAuth(
      (user, token) => {
        setGoogleUser(user);
        setGoogleToken(token);
      },
      () => {
        setGoogleUser(null);
        setGoogleToken(null);
      }
    );
  }, []);
  const [notifications, setNotifications] = useState<Notification[]>([
    { id: '1', title: 'Grade Updated: Midterm', message: 'Your grade for Introduction to Algorithms has been posted.', time: '1 hr ago', read: false, type: 'urgent' },
    { id: '2', title: 'New Lecture Added', message: 'CS-101: Week 4 "Data Structures" lecture slides are now available on the LMS.', time: '2 hrs ago', read: false, type: 'routine' },
    { id: '3', title: 'Assignment Reminder', message: 'Your Calculus II problem set is due tomorrow at 11:59 PM.', time: '4 hrs ago', read: false, type: 'urgent' },
    { id: '4', title: 'System Maintenance', message: 'The LMS will be down for maintenance this Sunday 2 AM - 4 AM.', time: '1 day ago', read: true, type: 'routine' },
  ]);

  useEffect(() => {
    const socket = io();

    socket.on("notification:new", (newNotif: Notification) => {
      setNotifications(prev => [newNotif, ...prev]);
      setShowNotifications(true); // Auto-open for visibility during demo
    });

    fetchSessions();

    return () => {
      socket.disconnect();
    };
  }, []);

  const fetchSessions = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/chat/sessions', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setSessions(data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleNewChat = () => {
    setSessionId(null);
    localStorage.removeItem('currentSessionId');
    setCurrentView('chat');
  };

  const handleSelectSession = (id: string) => {
    setSessionId(id);
    localStorage.setItem('currentSessionId', id);
    setCurrentView('chat');
  };

  return (
    <div className="h-screen flex bg-gray-950 text-gray-100 overflow-hidden selection:bg-cyan-500/30 font-sans">
      {/* Sidebar (Desktop) */}
      <aside className="w-20 lg:w-72 border-r border-gray-800/60 bg-gray-950/50 flex flex-col items-center lg:items-stretch py-6 backdrop-blur-md z-10 transition-all duration-300">
        <div className="flex items-center justify-center lg:justify-start lg:px-6 mb-8 gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-cyan-400 to-emerald-400 rounded-xl flex items-center justify-center shrink-0 shadow-lg shadow-emerald-500/10">
            <GraduationCap className="text-gray-950 w-5 h-5" />
          </div>
          <span className="hidden lg:block font-bold text-lg tracking-tight">Neuro</span>
        </div>

        <nav className="flex flex-col gap-1 px-3 lg:px-4">
          <NavItem icon={<Book />} label="AI Chat" active={currentView === 'chat'} onClick={() => setCurrentView('chat')} />
          {user?.role === 'staff' && (
            <NavItem icon={<BarChart3 />} label="Analytics (Staff)" active={currentView === 'analytics'} onClick={() => setCurrentView('analytics')} />
          )}
          <NavItem icon={<User />} label="Profile" active={currentView === 'profile'} onClick={() => setCurrentView('profile')} />
          <NavItem icon={<Zap />} label="Study Plan" active={currentView === 'studyPlan'} onClick={() => setCurrentView('studyPlan')} />
          <NavItem icon={<Calendar />} label="Schedule" active={currentView === 'schedule'} onClick={() => setCurrentView('schedule')} />
        </nav>

        {/* Chat History Section */}
        <div className="hidden lg:block mt-8 flex-1 overflow-y-auto px-4">
          <div className="flex items-center justify-between mb-3 px-2">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-widest flex items-center gap-2">
              <Clock className="w-3.5 h-3.5" /> Recent Sessions
            </h3>
            <button 
              onClick={handleNewChat}
              className="p-1 hover:bg-gray-800 rounded-md text-cyan-400 transition-colors"
              title="New Chat"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
          <ul className="space-y-1">
            {sessions.map(session => (
              <li key={session.id}>
                <button 
                  onClick={() => handleSelectSession(session.id)}
                  className={`w-full text-left px-3 py-2 rounded-lg hover:bg-gray-900 text-sm transition-colors flex items-center justify-between group ${sessionId === session.id ? 'bg-gray-900 text-cyan-400' : 'text-gray-400 hover:text-gray-200'}`}
                >
                  <span className="truncate pr-2">{session.title}</span>
                </button>
              </li>
            ))}
            {sessions.length === 0 && (
              <p className="text-[10px] text-gray-600 px-2 italic">No recent chats</p>
            )}
          </ul>
        </div>

        <div className="mt-auto px-3 lg:px-4 pt-4 border-t border-gray-800/60 hidden lg:block">
          <div className="flex items-center gap-3 px-3 py-2 mb-2">
            <div className="w-8 h-8 rounded-full bg-gray-800 flex items-center justify-center text-cyan-500 shrink-0 capitalize">
              {user?.name?.[0] || 'U'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-200 truncate">{user?.email}</p>
              <p className="text-[10px] text-gray-500 uppercase tracking-wider">{user?.role}</p>
            </div>
          </div>
          <button 
            onClick={onLogout}
            className="w-full flex items-center justify-start gap-3 p-3 text-gray-400 hover:text-red-400 hover:bg-red-900/10 rounded-xl transition-all group"
          >
            <LogOut className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
            <span className="font-medium text-sm">Logout</span>
          </button>
        </div>
        
        {/* Mobile logout */}
        <div className="mt-auto px-3 lg:hidden">
          <button 
            onClick={onLogout}
            className="w-full flex items-center justify-center p-3 text-gray-400 hover:text-red-400 hover:bg-gray-900 rounded-xl transition-all"
          >
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col relative h-full min-w-0">
        {/* Header */}
        <header className="h-16 border-b border-gray-800/60 bg-gray-950/50 backdrop-blur-xl flex items-center justify-between px-6 z-20 sticky top-0">
          <div className="flex items-center gap-3">
            <h2 className="font-semibold text-lg hover:text-cyan-400 transition-colors cursor-pointer">
              {currentView === 'chat' && 'CS-101 Assistant'}
              {currentView === 'analytics' && 'Platform Analytics'}
              {currentView === 'profile' && 'Student Profile'}
              {currentView === 'studyPlan' && 'Curriculum & Progress'}
              {currentView === 'schedule' && 'Calendar & Schedule'}
            </h2>
            {currentView === 'chat' && (
              <span className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 text-xs font-mono border border-emerald-500/20">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                Online
              </span>
            )}
          </div>
          
          <button 
            onClick={() => setShowNotifications(!showNotifications)}
            className="relative p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-full transition-colors"
          >
            <Bell className="w-5 h-5" />
            <span className="absolute top-1 right-1.5 w-2 h-2 rounded-full bg-cyan-500 shadow-[0_0_8px_rgba(6,182,212,0.8)] animate-pulse"></span>
          </button>
        </header>

        {currentView === 'chat' && <ChatWindow sessionId={sessionId} onSessionCreated={(id) => {setSessionId(id); fetchSessions();}} googleToken={googleToken} />}
        {currentView === 'analytics' && <AnalyticsDashboard />}
        {currentView === 'profile' && <StudentProfile googleUser={googleUser} googleToken={googleToken} onGoogleAuth={setGoogleToken} />}
        {currentView === 'studyPlan' && <StudyPlanView />}
        {currentView === 'schedule' && <ScheduleView googleToken={googleToken} />}

        {/* Notifications Panel */}
        <AnimatePresence>
          {showNotifications && (
            <NotificationsPanel 
              notifications={notifications} 
              onClose={() => setShowNotifications(false)} 
              onMarkRead={() => setNotifications(prev => prev.map(n => ({...n, read: true})))}
            />
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}

// ----------------------------------------------------------------------
// Study Plan View
// ----------------------------------------------------------------------
function StudyPlanView() {
  const [data, setData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchPlan = async () => {
      try {
        const token = localStorage.getItem('token');
        const res = await fetch('/api/sis/study-plan', {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) {
          const json = await res.json();
          setData(json);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchPlan();
  }, []);

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-gray-800 border-t-cyan-500 rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-gray-500 gap-4">
        <Info className="w-12 h-12 opacity-20" />
        <p>Could not retrieve curriculum data.</p>
      </div>
    );
  }

  const progressPercent = Math.round((data.completedCredits / data.totalCredits) * 100);

  return (
    <div className="flex-1 overflow-y-auto p-6 md:p-8">
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Overall Progress */}
        <section className="bg-gray-900/40 border border-gray-800 rounded-3xl p-8">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-8">
            <div>
              <h3 className="text-gray-400 text-sm font-semibold uppercase tracking-widest mb-1">Academic Progress</h3>
              <p className="text-3xl font-bold text-gray-100">{progressPercent}% Complete</p>
            </div>
            <div className="text-right">
              <p className="text-gray-400 text-sm">{data.completedCredits} / {data.totalCredits} Credit Hours</p>
            </div>
          </div>
          
          <div className="h-4 w-full bg-gray-950 rounded-full overflow-hidden border border-gray-800">
            <motion.div 
              initial={{ width: 0 }}
              animate={{ width: `${progressPercent}%` }}
              transition={{ duration: 1, ease: "easeOut" }}
              className="h-full bg-gradient-to-r from-cyan-500 to-emerald-500 shadow-[0_0_20px_rgba(6,182,212,0.3)]"
            />
          </div>
        </section>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* In Progress */}
          <div className="lg:col-span-1 space-y-4">
            <h4 className="flex items-center gap-2 text-sm font-semibold text-gray-400 px-2 uppercase tracking-wider">
              <Clock className="w-4 h-4 text-cyan-400" /> Current Enrollment
            </h4>
            <div className="space-y-3">
              {data.currentCourses.map((c: any, i: number) => (
                <div key={i} className="bg-cyan-500/5 border border-cyan-500/20 rounded-2xl p-4">
                  <p className="text-xs font-mono text-cyan-400 mb-1">{c.code}</p>
                  <p className="font-medium text-gray-200">{c.name}</p>
                  <p className="text-[10px] text-gray-500 mt-2">{c.credits} Credits</p>
                </div>
              ))}
            </div>
          </div>

          {/* Detailed Course Breakdown */}
          <div className="lg:col-span-2 space-y-6">
            <div className="space-y-4">
               <h4 className="flex items-center gap-2 text-sm font-semibold text-gray-400 px-2 uppercase tracking-wider">
                <CheckCircle className="w-4 h-4 text-emerald-400" /> Completed Courses
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {data.completedCourses.slice(0, 6).map((c: any, i: number) => (
                  <div key={i} className="bg-gray-900/30 border border-gray-800 rounded-xl p-3 flex justify-between items-center">
                    <div>
                      <p className="text-[10px] font-mono text-gray-500 uppercase">{c.code}</p>
                      <p className="text-sm font-medium text-gray-300 truncate max-w-[150px]">{c.name}</p>
                    </div>
                    <div className="w-6 h-6 rounded-full bg-emerald-500/10 flex items-center justify-center">
                      <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />
                    </div>
                  </div>
                ))}
                {data.completedCourses.length > 6 && (
                  <div className="bg-gray-900/10 border border-dashed border-gray-800 rounded-xl p-3 flex items-center justify-center text-xs text-gray-600">
                    + {data.completedCourses.length - 6} more completed
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-4">
               <h4 className="flex items-center gap-2 text-sm font-semibold text-gray-400 px-2 uppercase tracking-wider">
                <Book className="w-4 h-4 text-gray-500" /> Remaining Requirements
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {data.remainingCourses.map((c: any, i: number) => (
                  <div key={i} className="bg-gray-900/20 border border-gray-800/50 rounded-xl p-3 flex justify-between items-center group hover:bg-gray-800/30 transition-all cursor-default">
                    <div>
                      <p className="text-[10px] font-mono text-gray-600 uppercase">{c.code}</p>
                      <p className="text-sm font-medium text-gray-400">{c.name}</p>
                    </div>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-mono ${c.category === 'Core' ? 'bg-purple-500/10 text-purple-400' : 'bg-orange-500/10 text-orange-400'}`}>
                      {c.category}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ----------------------------------------------------------------------
// Reusable UI Components
// ----------------------------------------------------------------------
function NavItem({ icon, label, active = false, onClick }: { icon: React.ReactNode, label: string, active?: boolean, onClick?: () => void }) {
  return (
    <button 
      onClick={onClick}
      className={`flex items-center justify-center lg:justify-start gap-3 p-3 rounded-xl transition-all w-full ${
        active 
          ? 'bg-gradient-to-r from-gray-800 to-gray-900 border border-gray-700 text-cyan-400 shadow-sm' 
          : 'text-gray-400 hover:text-gray-200 hover:bg-gray-900 border border-transparent'
      }`}
    >
      {React.cloneElement(icon as React.ReactElement, { className: 'w-5 h-5' })}
      <span className="hidden lg:block font-medium text-sm">{label}</span>
    </button>
  );
}

// ----------------------------------------------------------------------
// Analytics Dashboard (Staff View)
// ----------------------------------------------------------------------
function AnalyticsDashboard() {
  const [isTriggering, setIsTriggering] = useState(false);

  const engagementData = [
    { name: 'Mon', questions: 400, activeStudents: 240 },
    { name: 'Tue', questions: 300, activeStudents: 139 },
    { name: 'Wed', questions: 550, activeStudents: 400 },
    { name: 'Thu', questions: 278, activeStudents: 208 },
    { name: 'Fri', questions: 189, activeStudents: 100 },
    { name: 'Sat', questions: 239, activeStudents: 150 },
    { name: 'Sun', questions: 349, activeStudents: 220 },
  ];

  const topicsData = [
    { name: 'Calculus', queries: 850 },
    { name: 'Python Basics', queries: 720 },
    { name: 'Data Structures', queries: 900 },
    { name: 'Biology', queries: 400 },
  ];

  const triggerUrgentNotif = async () => {
    setIsTriggering(true);
    try {
      const token = localStorage.getItem('token');
      await fetch('/api/admin/trigger-notif', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          title: "EMERGENCY: Room Change",
          message: "Calculus finals moved to Building 7, Auditorium B. Please arrive 15 minutes early and bring your student ID.",
          type: "urgent"
        })
      });
    } catch (err) {
      console.error(err);
    } finally {
      setTimeout(() => setIsTriggering(false), 500);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-6">
      {/* Staff Admin Actions */}
      <div className="bg-red-500/10 border border-red-500/20 rounded-3xl p-6 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div>
          <h3 className="text-red-400 font-bold flex items-center gap-2">
            <ShieldAlert className="w-5 h-5" /> Urgent Broadcast
          </h3>
          <p className="text-sm text-gray-400 mt-1">Send a real-time urgent notification to all active students.</p>
        </div>
        <button 
          onClick={triggerUrgentNotif}
          disabled={isTriggering}
          className="bg-red-500 hover:bg-red-600 disabled:bg-gray-800 text-white font-semibold py-3 px-6 rounded-2xl transition-all shadow-lg shadow-red-500/20 active:scale-95 flex items-center gap-2"
        >
          {isTriggering ? 'Broadcasting...' : 'Trigger Emergency Alert'}
          <AlertTriangle className="w-4 h-4" />
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-gray-900/50 border border-gray-800 rounded-3xl p-6 shadow-sm">
          <div className="flex items-center gap-3 text-cyan-400 mb-2">
            <Users className="w-5 h-5" />
            <h3 className="font-semibold">Active Students</h3>
          </div>
          <p className="text-3xl font-bold">1,204</p>
          <p className="text-xs text-emerald-400 mt-2 flex items-center gap-1"><TrendingUp className="w-3 h-3"/> +12% from last week</p>
        </div>
        <div className="bg-gray-900/50 border border-gray-800 rounded-3xl p-6 shadow-sm">
          <div className="flex items-center gap-3 text-emerald-400 mb-2">
            <Book className="w-5 h-5" />
            <h3 className="font-semibold">Questions Answered</h3>
          </div>
          <p className="text-3xl font-bold">8,430</p>
          <p className="text-xs text-emerald-400 mt-2 flex items-center gap-1"><TrendingUp className="w-3 h-3"/> +5% from last week</p>
        </div>
        <div className="bg-gray-900/50 border border-gray-800 rounded-3xl p-6 shadow-sm">
          <div className="flex items-center gap-3 text-amber-400 mb-2">
            <Zap className="w-5 h-5" />
            <h3 className="font-semibold">Avg. Response Time</h3>
          </div>
          <p className="text-3xl font-bold">1.2s</p>
          <p className="text-xs text-gray-500 mt-2">Optimal performance</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Engagement Chart */}
        <div className="bg-gray-900/40 border border-gray-800 rounded-3xl p-6">
          <h3 className="font-semibold mb-6 flex items-center gap-2 text-gray-300">
            <ActivityIcon /> Student Engagement Trends
          </h3>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={engagementData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorQs" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#06b6d4" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" vertical={false} />
                <XAxis dataKey="name" stroke="#9ca3af" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="#9ca3af" fontSize={12} tickLine={false} axisLine={false} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#111827', borderColor: '#374151', borderRadius: '12px' }}
                  itemStyle={{ color: '#e5e7eb' }}
                />
                <Area type="monotone" dataKey="questions" stroke="#06b6d4" strokeWidth={3} fillOpacity={1} fill="url(#colorQs)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Popular Topics Chart */}
        <div className="bg-gray-900/40 border border-gray-800 rounded-3xl p-6">
          <h3 className="font-semibold mb-6 flex items-center gap-2 text-gray-300">
            <Book className="w-4 h-4" /> Top Queried Topics
          </h3>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={topicsData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" horizontal={false} />
                <XAxis type="number" stroke="#9ca3af" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis dataKey="name" type="category" stroke="#9ca3af" fontSize={12} tickLine={false} axisLine={false} width={100} />
                <Tooltip 
                  cursor={{ fill: '#1f2937' }}
                  contentStyle={{ backgroundColor: '#111827', borderColor: '#374151', borderRadius: '12px' }}
                />
                <Bar dataKey="queries" fill="#10b981" radius={[0, 6, 6, 0]} barSize={24} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}

function ActivityIcon() {
  return <TrendingUp className="w-4 h-4" />;
}

// ----------------------------------------------------------------------
// Chat Window & Input
// ----------------------------------------------------------------------
function ChatWindow({ sessionId, onSessionCreated, googleToken }: { sessionId: string | null, onSessionCreated: (id: string) => void, googleToken: string | null }) {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      text: "Hello! I'm your AI teaching assistant. How can I help you with your studies today?",
      sender: 'bot',
      timestamp: new Date()
    }
  ]);
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (sessionId) {
      loadSessionHistory(sessionId);
    } else {
      setMessages([
        {
          id: '1',
          text: "Hello! I'm your AI teaching assistant. How can I help you with your studies today?",
          sender: 'bot',
          timestamp: new Date()
        }
      ]);
    }
  }, [sessionId]);

  const loadSessionHistory = async (id: string) => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/chat/sessions/${id}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setMessages(data.map((m: any) => ({
          ...m,
          timestamp: new Date() // Just for relative demo timing, actual time is in time string
        })));
      }
    } catch (err) {
      console.error(err);
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping]);

  const handleSend = async () => {
    if (!inputValue.trim()) return;

    const newUserMsg: Message = {
      id: Date.now().toString(),
      text: inputValue,
      sender: 'user',
      timestamp: new Date()
    };

    setMessages(prev => [...prev, newUserMsg]);
    setInputValue('');
    setIsTyping(true);

    try {
      const token = localStorage.getItem('token');
      let calendarData = null;

      if (googleToken) {
        try {
          const events = await fetchCalendarEvents(googleToken);
          calendarData = Array.isArray(events.items) ? events.items.map((e: any) => `${e.summary} (${e.start?.dateTime || e.start?.date})`).join(', ') : null;
        } catch (err) {
          console.warn("Failed to fetch calendar for context", err);
        }
      }

      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ 
          message: newUserMsg.text, 
          sessionId,
          calendarContext: calendarData
        }),
      });
      
      const data = await res.json();
      
      if (res.ok) {
        setMessages(prev => [...prev, {
          id: (Date.now() + 1).toString(),
          text: data.reply,
          sender: 'bot',
          timestamp: new Date()
        }]);
        if (!sessionId) {
          onSessionCreated(data.sessionId);
        }
      } else {
        throw new Error(data.error);
      }
    } catch (error) {
      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        text: "Sorry, I'm having trouble connecting right now. Please try again later.",
        sender: 'bot',
        timestamp: new Date()
      }]);
    } finally {
      setIsTyping(false);
    }
  };

  const handleQuickReply = (text: string) => {
    setInputValue(text);
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-gray-950 relative">
      <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-[0.02] pointer-events-none"></div>

      <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 scroll-smooth pb-8">
        {messages.map((msg) => (
          <motion.div 
            key={msg.id}
            initial={{ opacity: 0, y: 10, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div className={`max-w-[85%] md:max-w-[70%] rounded-3xl px-6 py-4 shadow-sm ${
              msg.sender === 'user' 
                ? 'bg-gradient-to-br from-cyan-600 to-cyan-500 text-white rounded-br-sm' 
                : 'bg-gray-900 border border-gray-800 text-gray-200 rounded-bl-sm'
            }`}>
              {msg.sender === 'bot' && (
                <div className="flex items-center gap-2 mb-2 text-[11px] text-gray-400 font-semibold tracking-widest uppercase font-mono">
                  <Zap className="w-3 h-3 text-emerald-400" /> AI Assistant
                </div>
              )}
              <p className="leading-relaxed whitespace-pre-wrap text-sm sm:text-base">{msg.text}</p>
              <div className={`text-[10px] mt-2 font-mono ${msg.sender === 'user' ? 'text-cyan-100/70 text-right' : 'text-gray-500 text-left'}`}>
                {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </div>
            </div>
          </motion.div>
        ))}

        {isTyping && (
          <motion.div 
             initial={{ opacity: 0 }}
             animate={{ opacity: 1 }}
             className="flex justify-start"
          >
            <div className="bg-gray-900 border border-gray-800 rounded-3xl rounded-bl-sm px-6 py-4 w-24">
              <div className="flex gap-1.5 justify-center">
                <span className="w-2 h-2 bg-emerald-500 rounded-full animate-bounce [animation-delay:-0.3s]"></span>
                <span className="w-2 h-2 bg-emerald-500 rounded-full animate-bounce [animation-delay:-0.15s]"></span>
                <span className="w-2 h-2 bg-emerald-500 rounded-full animate-bounce"></span>
              </div>
            </div>
          </motion.div>
        )}
        <div ref={messagesEndRef} className="h-px" />
      </div>

      {/* Input Area */}
      <div className="bg-gray-950/80 backdrop-blur-xl border-t border-gray-800/80 p-4 sm:p-6 z-10">
        <div className="max-w-4xl mx-auto">
          
          {/* Quick Replies */}
          <div className="flex gap-2 overflow-x-auto pb-3 scrollbar-hide">
            {["When can I register?", "What are the GPA rules?", "Where is my exam schedule?"].map((text, i) => (
              <button 
                key={i}
                onClick={() => handleQuickReply(text)}
                className="whitespace-nowrap px-4 py-2 rounded-full border border-gray-800 bg-gray-900 hover:bg-gray-800 text-xs text-gray-300 transition-colors flex-shrink-0"
              >
                {text}
              </button>
            ))}
          </div>

          <div className="relative flex items-end gap-2 bg-gray-900/60 border border-gray-700 rounded-2xl p-2 shadow-inner focus-within:ring-1 focus-within:ring-cyan-500/50 focus-within:border-cyan-500/50 transition-all">
            <textarea 
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              placeholder="Ask me anything about your courses..."
              className="w-full max-h-32 min-h-[44px] bg-transparent resize-none outline-none text-gray-100 placeholder-gray-500 px-3 py-2.5 text-sm sm:text-base leading-relaxed scrollbar-hide"
              rows={1}
            />
            <button 
              onClick={handleSend}
              disabled={!inputValue.trim() || isTyping}
              className="p-3.5 bg-cyan-500 hover:bg-cyan-400 disabled:bg-gray-800 disabled:text-gray-600 text-gray-950 rounded-xl transition-all shrink-0 active:scale-95"
            >
              <Send className="w-5 h-5 flex-shrink-0" />
            </button>
          </div>
          <div className="text-center mt-2">
            <p className="text-[10px] text-gray-500 uppercase tracking-widest font-mono">Real-time NLP Engine Active</p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ----------------------------------------------------------------------
// Notifications Panel
// ----------------------------------------------------------------------
function NotificationsPanel({ notifications, onClose, onMarkRead }: { notifications: Notification[], onClose: () => void, onMarkRead: () => void }) {
  return (
    <>
      <motion.div 
        initial={{ opacity: 0 }} 
        animate={{ opacity: 1 }} 
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-black/40 backdrop-blur-sm z-40 lg:hidden" 
      />
      
      <motion.div 
        initial={{ x: '100%', opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        exit={{ x: '100%', opacity: 0 }}
        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
        className="absolute top-0 right-0 w-full sm:w-[400px] h-full bg-gray-950/95 border-l border-gray-800 z-50 flex flex-col shadow-2xl backdrop-blur-2xl"
      >
        <div className="flex items-center justify-between p-6 border-b border-gray-800">
          <h3 className="font-semibold text-lg flex items-center gap-2">
            <Bell className="w-5 h-5 text-cyan-400" />
            Notifications
          </h3>
          <button onClick={onClose} className="p-2 bg-gray-900 rounded-full hover:bg-gray-800 transition-colors">
            <X className="w-4 h-4 text-gray-400" />
          </button>
        </div>
        
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {notifications.map(n => (
            <div 
              key={n.id} 
              className={`p-4 rounded-2xl border transition-colors relative overflow-hidden ${
                n.read 
                  ? 'bg-gray-900/50 border-gray-800/50 opacity-70' 
                  : n.type === 'urgent' 
                    ? 'bg-red-500/5 border-red-500/20 shadow-sm shadow-red-500/5' 
                    : 'bg-gray-900 border-gray-700 shadow-sm'
              }`}
            >
              {n.type === 'urgent' && !n.read && (
                <div className="absolute top-0 left-0 w-1 h-full bg-red-500"></div>
              )}
              <div className="flex justify-between items-start mb-1.5 pl-2">
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-2">
                    {n.type === 'urgent' ? <AlertTriangle className="w-4 h-4 text-red-500" /> : <Info className="w-4 h-4 text-cyan-400" />}
                    <h4 className={`text-sm font-semibold tracking-tight ${n.read ? 'text-gray-400' : n.type === 'urgent' ? 'text-red-100' : 'text-gray-100'}`}>{n.title}</h4>
                  </div>
                </div>
                {!n.read && <span className={`w-2 h-2 rounded-full shrink-0 mt-1 ${n.type === 'urgent' ? 'bg-red-500' : 'bg-cyan-500'}`}></span>}
              </div>
              <p className="text-sm text-gray-400 leading-snug mb-3 pl-2 pr-4">{n.message}</p>
              <p className="text-[10px] text-gray-500 font-mono tracking-wide pl-2 flex items-center gap-1">
                <Clock className="w-3 h-3" /> {n.time}
              </p>
            </div>
          ))}
        </div>
        
        <div className="p-4 border-t border-gray-800 bg-gray-950 text-center">
          <button 
            onClick={onMarkRead}
            className="text-xs text-gray-400 hover:text-cyan-400 transition-colors uppercase tracking-widest font-semibold flex items-center gap-2 mx-auto"
          >
            Mark All as Read
          </button>
        </div>
      </motion.div>
    </>
  );
}

// ----------------------------------------------------------------------
// Schedule View
// ----------------------------------------------------------------------
function ScheduleView({ googleToken }: { googleToken: string | null }) {
  const [events, setEvents] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (googleToken) {
      loadEvents();
    }
  }, [googleToken]);

  const loadEvents = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await fetchCalendarEvents(googleToken!);
      setEvents(data.items || []);
    } catch (err) {
      console.error(err);
      setError("Failed to sync with Google Calendar.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleConnect = async () => {
    try {
      await googleSignIn();
    } catch (err) {
      console.error(err);
    }
  };

  if (!googleToken) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center space-y-6">
        <div className="w-20 h-20 bg-gray-900 border border-gray-800 rounded-3xl flex items-center justify-center text-gray-600">
          <Calendar className="w-10 h-10" />
        </div>
        <div className="max-w-xs">
          <h3 className="text-xl font-bold mb-2">Sync Your Schedule</h3>
          <p className="text-gray-400 text-sm">Connect your Google Calendar to view upcoming exams, lectures, and academic deadlines directly in Neuro.</p>
        </div>
        <button 
          onClick={handleConnect}
          className="bg-white text-gray-950 px-6 py-3 rounded-xl font-semibold hover:bg-gray-200 transition-colors flex items-center gap-2"
        >
          Connect Google Calendar
        </button>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-gray-800 border-t-cyan-500 rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-6 md:p-8">
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <h3 className="text-gray-400 text-sm font-semibold uppercase tracking-widest">Upcoming Agenda</h3>
          <button onClick={loadEvents} className="text-xs text-cyan-400 hover:underline">Refresh</button>
        </div>

        {error && (
          <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-2xl text-red-400 text-sm">
            {error}
          </div>
        )}

        <div className="space-y-4">
          {events.length > 0 ? events.map((event) => (
            <div key={event.id} className="bg-gray-900/40 border border-gray-800 rounded-2xl p-5 hover:border-gray-700 transition-all">
              <div className="flex justify-between items-start gap-4">
                <div className="flex-1">
                  <h4 className="font-bold text-gray-100">{event.summary}</h4>
                  <div className="flex items-center gap-3 mt-2">
                    <div className="flex items-center gap-1.5 text-xs text-gray-500">
                      <Clock className="w-3.5 h-3.5" />
                      {new Date(event.start?.dateTime || event.start?.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-cyan-500/80 font-mono">
                      <Plus className="w-3.5 h-3.5" />
                      {new Date(event.start?.dateTime || event.start?.date).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                    </div>
                  </div>
                </div>
                {event.location && (
                  <div className="hidden sm:block text-right">
                    <p className="text-[10px] text-gray-600 uppercase tracking-tighter">Location</p>
                    <p className="text-xs text-gray-400 max-w-[120px] truncate">{event.location}</p>
                  </div>
                )}
              </div>
            </div>
          )) : (
            <div className="bg-gray-900/20 border border-dashed border-gray-800 rounded-3xl p-12 text-center">
              <p className="text-gray-500 text-sm italic">No upcoming events found in your primary calendar.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ----------------------------------------------------------------------
// Student Profile View
// ----------------------------------------------------------------------
function StudentProfile({ googleUser, googleToken, onGoogleAuth }: { googleUser: any, googleToken: string | null, onGoogleAuth?: (token: string) => void }) {
  const [profile, setProfile] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  const handleConnectGoogle = async () => {
    try {
      const result = await googleSignIn();
      if (result && onGoogleAuth) {
        onGoogleAuth(result.accessToken);
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const token = localStorage.getItem('token');
        const res = await fetch('/api/sis/profile', {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        if (res.ok) {
          const data = await res.json();
          setProfile(data);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchProfile();
  }, []);

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-gray-800 border-t-cyan-500 rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="flex-1 flex items-center justify-center text-gray-500">
        Failed to load profile data.
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-6 md:p-8">
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="bg-gray-900/50 border border-gray-800 rounded-3xl p-8 flex flex-col md:flex-row items-center md:items-start gap-6">
          <div className="w-24 h-24 rounded-full bg-gradient-to-br from-cyan-500 to-emerald-500 flex items-center justify-center text-3xl font-bold text-gray-950">
            {profile.name?.split(' ').map((n: string) => n[0]).join('') || profile.studentId?.substring(0, 2)}
          </div>
          <div className="text-center md:text-left flex-1">
            <h2 className="text-2xl font-bold text-gray-100">{profile.name}</h2>
            <p className="text-gray-400 font-mono mt-1 text-sm">{profile.studentId}</p>
            <div className="flex flex-wrap items-center justify-center md:justify-start gap-3 mt-4">
              <span className="px-3 py-1 bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 rounded-full text-xs font-medium">
                {profile.year}
              </span>
              <span className="px-3 py-1 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-full text-xs font-medium">
                {profile.academicStanding}
              </span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-gray-900/30 border border-gray-800 rounded-3xl p-6">
            <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-widest mb-4">Academic Details</h3>
            <div className="space-y-4">
              <div>
                <p className="text-xs text-gray-500 mb-1">Major</p>
                <p className="font-medium text-gray-200">{profile.major}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-1">Academic Advisor</p>
                <p className="font-medium text-gray-200">{profile.advisor}</p>
              </div>
            </div>
          </div>

          <div className="bg-gray-900/30 border border-gray-800 rounded-3xl p-6">
             <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-widest mb-4">Integrations</h3>
             <div className="space-y-4">
              {!googleToken ? (
                <button 
                  onClick={handleConnectGoogle}
                  className="w-full bg-white text-gray-950 text-sm font-semibold rounded-xl py-2 shadow-lg hover:bg-gray-200 transition-all flex items-center justify-center gap-2"
                >
                  Connect Google Account
                </button>
              ) : (
                <div className="flex items-center gap-3 p-3 bg-emerald-500/5 border border-emerald-500/20 rounded-xl">
                  <div className="w-8 h-8 rounded-full bg-emerald-500 flex items-center justify-center text-gray-950 font-bold text-xs uppercase">
                    {googleUser?.displayName?.[0] || 'G'}
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-emerald-400">Connected to Google</p>
                    <p className="text-[10px] text-gray-500 truncate max-w-[150px]">{googleUser?.email}</p>
                  </div>
                </div>
              )}
             </div>
          </div>
        </div>

        {profile.registered_courses && profile.registered_courses.length > 0 && (
          <div className="bg-gray-900/30 border border-gray-800 rounded-3xl p-6">
            <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-widest mb-4">Currently Enrolled</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {profile.registered_courses.map((course: string, idx: number) => (
                <div key={idx} className="flex items-center gap-3 p-3 bg-gray-950/40 border border-gray-800/50 rounded-xl">
                  <div className="w-8 h-8 rounded-lg bg-cyan-500/10 flex items-center justify-center text-cyan-400">
                    <Book className="w-4 h-4" />
                  </div>
                  <span className="text-gray-300 text-sm font-medium">{course}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
