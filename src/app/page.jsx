'use client';
import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { motion } from 'framer-motion';
import { 
  Code, 
  Database, 
  LineChart, 
  ChevronRight, 
  Github, 
  Linkedin, 
  Mail, 
  Sun, 
  Moon,
  Download,
  ArrowUp,
  MessageCircle
} from 'lucide-react';
import { Button } from "@/components/ui/button";
import { 
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Progress } from "@/components/ui/progress";

export default function Page() {
  // State management
  const [isScrolled, setIsScrolled] = useState(false);
  const [darkMode, setDarkMode] = useState(true);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [scrollProgress, setScrollProgress] = useState(0);
  const [currentSkillIndex, setCurrentSkillIndex] = useState(0);
  
  const skills = ["Data Scientist", "Machine Learning Engineer", "Marketing Manager", "World Record Holder"];
  const heroRef = useRef(null);
  
  // Handle scroll for various effects
  useEffect(() => {
    const handleScroll = () => {
      // For navbar transparency
      if (window.scrollY > 50) {
        setIsScrolled(true);
      } else {
        setIsScrolled(false);
      }
      
      // For scroll to top button
      if (window.scrollY > 500) {
        setShowScrollTop(true);
      } else {
        setShowScrollTop(false);
      }
      
      // For progress bar
      const winScroll = document.body.scrollTop || document.documentElement.scrollTop;
      const height = document.documentElement.scrollHeight - document.documentElement.clientHeight;
      const scrolled = (winScroll / height) * 100;
      setScrollProgress(scrolled);
    };
    
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);
  
  // For cycling through skills
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentSkillIndex(prevIndex => (prevIndex + 1) % skills.length);
    }, 3000);
    
    return () => clearInterval(interval);
  }, []);
  
  // For dark/light mode toggle
  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [darkMode]);
  
  // For particle animation
  const ParticleBackground = () => {
    return (
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {[...Array(50)].map((_, i) => (
          <div 
            key={i}
            className="absolute rounded-full bg-blue-500/20 dark:bg-blue-400/10"
            style={{
              top: `${Math.random() * 100}%`,
              left: `${Math.random() * 100}%`,
              width: `${Math.random() * 10 + 5}px`,
              height: `${Math.random() * 10 + 5}px`,
              animation: `float ${Math.random() * 10 + 20}s linear infinite`,
              animationDelay: `${Math.random() * 10}s`
            }}
          />
        ))}
      </div>
    );
  };
  
  // Scroll to top function
  const scrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: 'smooth'
    });
  };

  return (
    <div className={`min-h-screen bg-gradient-to-br ${darkMode ? 'from-slate-950 to-slate-900 text-white' : 'from-slate-50 to-white text-slate-900'} transition-colors duration-300`}>
      {/* Progress bar */}
      <Progress value={scrollProgress} className="fixed top-0 left-0 right-0 z-50 h-1 bg-transparent" indicatorClassName={`${darkMode ? 'bg-blue-500' : 'bg-blue-600'}`} />
      
      {/* Scroll to top button */}
      <button 
        onClick={scrollToTop}
        className={`fixed bottom-8 right-8 z-50 rounded-full p-3 bg-blue-600 text-white shadow-lg transition-transform duration-300 ${showScrollTop ? 'scale-100' : 'scale-0'}`}
      >
        <ArrowUp size={20} />
      </button>
      
      {/* Quick contact button */}
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Link href="#contact" className="fixed bottom-8 left-8 z-50 rounded-full p-3 bg-purple-600 text-white shadow-lg">
              <MessageCircle size={20} />
            </Link>
          </TooltipTrigger>
          <TooltipContent side="right">
            <p>Contact Me</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      {/* Navbar */}
      <header className={`fixed w-full z-40 transition-all duration-300 ${isScrolled ? (darkMode ? 'bg-slate-950/90 backdrop-blur-sm' : 'bg-white/90 backdrop-blur-sm shadow-sm') : 'bg-transparent'}`}>
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <Link href="/" className="text-xl font-bold tracking-wider">
              MIKAEEL FARAZ
            </Link>
            
            <nav className="hidden md:flex space-x-8">
              <Link href="#about" className={`${darkMode ? 'text-slate-300 hover:text-blue-400' : 'text-slate-700 hover:text-blue-600'} transition-colors`}>ABOUT</Link>
              <Link href="#services" className={`${darkMode ? 'text-slate-300 hover:text-blue-400' : 'text-slate-700 hover:text-blue-600'} transition-colors`}>SERVICES</Link>
              <Link href="#skills" className={`${darkMode ? 'text-slate-300 hover:text-blue-400' : 'text-slate-700 hover:text-blue-600'} transition-colors`}>SKILLS</Link>
              <Link href="#experience" className={`${darkMode ? 'text-slate-300 hover:text-blue-400' : 'text-slate-700 hover:text-blue-600'} transition-colors`}>EXPERIENCE</Link>
              <Link href="#records" className={`${darkMode ? 'text-slate-300 hover:text-blue-400' : 'text-slate-700 hover:text-blue-600'} transition-colors`}>RECORDS</Link>
              <Link href="#projects" className={`${darkMode ? 'text-slate-300 hover:text-blue-400' : 'text-slate-700 hover:text-blue-600'} transition-colors`}>PROJECTS</Link>
            </nav>
            
            <div className="flex items-center gap-4">
              <button 
                onClick={() => setDarkMode(!darkMode)} 
                className={`p-2 rounded-full ${darkMode ? 'bg-slate-800 text-yellow-400 hover:bg-slate-700' : 'bg-slate-200 text-slate-700 hover:bg-slate-300'} transition-colors`}
              >
                {darkMode ? <Sun size={18} /> : <Moon size={18} />}
              </button>
              
              <a
                href="/resume.pdf"
                download
                className="hidden md:flex items-center gap-2 px-4 py-2 border rounded-full border-slate-700 text-slate-300 hover:bg-slate-800 hover:text-white transition-colors"
              >
                <Download size={16} />
                Resume
              </a>
              
              <button className="md:hidden">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section with Code Background */}
      <section 
        ref={heroRef}
        className="relative min-h-screen flex items-center"
        id="hero"
      >
        {/* Particle background */}
        <ParticleBackground />
        
        {/* Code snippets overlay */}
        <div className="absolute right-0 top-0 h-full w-1/2 opacity-10 select-none pointer-events-none overflow-hidden">
          <div className="absolute text-blue-400 font-mono opacity-30 text-sm md:text-base top-1/4 right-1/3">
            console.log("Hello World");
          </div>
          <div className="absolute text-green-400 font-mono opacity-30 text-sm md:text-base bottom-1/3 right-1/4">
            import pandas as pd
          </div>
          <div className="absolute text-purple-400 font-mono opacity-30 text-sm md:text-base top-1/2 right-1/4">
            def train_model(X, y):
          </div>
          <div className="absolute text-indigo-400 font-mono opacity-30 text-sm md:text-base bottom-1/4 right-1/3">
            &lt;html&gt;
          </div>
          <div className="absolute text-pink-400 font-mono opacity-30 text-sm md:text-base bottom-2/5 right-1/5">
            $ npm install
          </div>
          <div className="absolute text-yellow-400 font-mono opacity-30 text-sm md:text-base top-3/5 right-1/6">
            class="container"
          </div>
          <div className="absolute text-cyan-400 font-mono opacity-30 text-sm md:text-base bottom-1/5 right-1/3">
            Grid
          </div>
          <div className="absolute text-red-400 font-mono opacity-30 text-sm md:text-base top-1/5 right-1/5">
            npm install
          </div>
        </div>
        
        <div className="container mx-auto px-4 z-10">
          <div className="flex flex-col md:flex-row items-center justify-between">
            <div className="md:w-1/2 mb-10 md:mb-0">
              <div className="inline-block mb-4 px-3 py-1 bg-blue-500/20 border border-blue-500/30 rounded-full">
                <span className={`${darkMode ? 'text-blue-400' : 'text-blue-600'} text-sm font-medium`}>
                  UNIVERSITY OF WOLLONGONG • DUBAI
                </span>
              </div>
              
              <motion.h1 
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                className="text-6xl md:text-8xl font-bold mb-6 bg-gradient-to-r from-pink-500 via-purple-500 to-blue-500 text-transparent bg-clip-text"
              >
                {skills[currentSkillIndex]}
              </motion.h1>
              
              <motion.p 
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.2 }}
                className={`text-xl md:text-2xl mb-8 ${darkMode ? 'text-slate-300' : 'text-slate-700'}`}
              >
                I am Mikaeel – <span className="text-blue-500">data scientist</span> with a unique blend of technical expertise and 
                <span className="text-purple-500"> digital marketing experience</span>, creating data-driven solutions that deliver real business impact.
              </motion.p>
              
              <div className="flex flex-wrap items-center gap-4 mb-8">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-green-500"></div>
                  <span className="text-sm">Available for projects</span>
                </div>
                
                <div className="h-4 border-r border-slate-400/30"></div>
                
                <div className="flex items-center gap-1">
                  <span className="text-sm font-medium">3x</span>
                  <span className="text-sm text-yellow-500">World Record Holder</span>
                </div>
              </div>
              
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.4 }}
                className="flex flex-wrap gap-4"
              >
                <Link href="/projects">
                  <Button className="rounded-full px-8 py-6 text-lg bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 transition-all">
                    VIEW MY WORK
                  </Button>
                </Link>
                
                <Link href="/contact">
                  <Button variant="outline" className={`rounded-full px-8 py-6 text-lg ${darkMode ? 'border-slate-700 text-slate-300 hover:bg-slate-800 hover:text-white' : 'border-slate-300 text-slate-700 hover:bg-slate-200 hover:text-slate-900'}`}>
                    CONTACT ME
                  </Button>
                </Link>
              </motion.div>
              
              <div className="mt-12 flex gap-8">
                <div>
                  <h3 className={`text-sm uppercase font-medium mb-2 ${darkMode ? 'text-slate-500' : 'text-slate-500'}`}>
                    Connect
                  </h3>
                  <div className="flex gap-4">
                    <a 
                      href="https://github.com/xdMikayu" 
                      target="_blank" 
                      rel="noopener noreferrer" 
                      className={`${darkMode ? 'text-slate-400 hover:text-white' : 'text-slate-500 hover:text-slate-900'} transition-colors`}
                    >
                      <Github size={20} />
                    </a>
                    <a 
                      href="https://www.linkedin.com/in/mikaeelf/" 
                      target="_blank" 
                      rel="noopener noreferrer" 
                      className={`${darkMode ? 'text-slate-400 hover:text-white' : 'text-slate-500 hover:text-slate-900'} transition-colors`}
                    >
                      <Linkedin size={20} />
                    </a>
                    <a 
                      href="mailto:mikaeel2013@gmail.com" 
                      className={`${darkMode ? 'text-slate-400 hover:text-white' : 'text-slate-500 hover:text-slate-900'} transition-colors`}
                    >
                      <Mail size={20} />
                    </a>
                  </div>
                </div>
                
                <div>
                  <h3 className={`text-sm uppercase font-medium mb-2 ${darkMode ? 'text-slate-500' : 'text-slate-500'}`}>
                    Specialties
                  </h3>
                  <div className="flex gap-2 flex-wrap">
                    <span className={`text-xs px-2 py-1 rounded-full ${darkMode ? 'bg-blue-950 text-blue-400' : 'bg-blue-100 text-blue-700'}`}>
                      Python
                    </span>
                    <span className={`text-xs px-2 py-1 rounded-full ${darkMode ? 'bg-purple-950 text-purple-400' : 'bg-purple-100 text-purple-700'}`}>
                      Marketing
                    </span>
                    <span className={`text-xs px-2 py-1 rounded-full ${darkMode ? 'bg-indigo-950 text-indigo-400' : 'bg-indigo-100 text-indigo-700'}`}>
                      ML
                    </span>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="md:w-1/2 md:flex md:justify-center relative">
              <div className="absolute inset-0 -z-10">
                <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-64 h-64 md:w-80 md:h-80 rounded-full bg-blue-500/20 blur-3xl"></div>
              </div>
              
              <div className="relative w-64 h-64 md:w-80 md:h-80 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-full flex items-center justify-center shadow-lg">
                <motion.div 
                  className="absolute -top-2 -right-2 w-16 h-16 bg-yellow-400 rounded-full flex items-center justify-center text-white"
                  animate={{ rotate: 360 }}
                  transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
                >
                  <svg className="w-10 h-10" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M19 5L5 19M5 5L19 19" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </motion.div>
                
                <div className="text-7xl font-bold text-white">MF</div>
                
                <div className="absolute -bottom-2 -left-2 w-12 h-12 bg-purple-600 rounded-full flex items-center justify-center text-white">
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M19 5L5 19M5 5L19 19" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
              </div>
            </div>
          </div>
          
          {/* Scroll indicator */}
          <div className="absolute bottom-10 left-1/2 transform -translate-x-1/2">
            <motion.div 
              animate={{ y: [0, 10, 0] }}
              transition={{ duration: 2, repeat: Infinity }}
              className="flex flex-col items-center"
            >
              <span className="text-sm mb-2">Scroll down</span>
              <svg className={`w-6 h-6 ${darkMode ? 'text-slate-400' : 'text-slate-600'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
              </svg>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Value Proposition Section */}
      <section id="about" className="py-20">
        <div className="container mx-auto px-4">
          <div className={`max-w-4xl mx-auto p-8 rounded-2xl ${darkMode ? 'bg-gradient-to-br from-slate-900 to-slate-800' : 'bg-gradient-to-br from-white to-slate-50'} shadow-xl`}>
            <h2 className="text-3xl font-bold mb-8 text-center">Where <span className="text-blue-500">Data Science</span> meets <span className="text-purple-500">Marketing Expertise</span></h2>
            
            <div className="flex flex-col md:flex-row gap-8 items-center">
              <div className="w-full md:w-1/2">
                <div className="aspect-square rounded-2xl overflow-hidden relative">
                  <div className="absolute inset-0 bg-gradient-to-br from-blue-500/20 to-purple-500/20 flex items-center justify-center">
                    <div className="w-20 h-20 rounded-full bg-white/10 backdrop-blur-sm flex items-center justify-center">
                      <div className="text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-500 to-purple-500">MF</div>
                    </div>
                  </div>
                  
                  <div className="absolute top-6 left-6 w-16 h-16 bg-blue-600/80 rounded-full flex items-center justify-center text-white">
                    <Database size={32} />
                  </div>
                  
                  <div className="absolute bottom-6 right-6 w-16 h-16 bg-purple-600/80 rounded-full flex items-center justify-center text-white">
                    <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="m3 11 18-5v12L3 13v-2z"/>
                      <path d="M11.6 16.8a3 3 0 1 1-5.8-1.6"/>
                    </svg>
                  </div>
                  
                  <div className="absolute top-1/3 right-6 w-12 h-12 bg-yellow-500/80 rounded-full flex items-center justify-center text-white">
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/>
                    </svg>
                  </div>
                  
                  <div className="absolute bottom-1/3 left-6 w-12 h-12 bg-green-500/80 rounded-full flex items-center justify-center text-white">
                    <LineChart size={24} />
                  </div>
                </div>
              </div>
              
              <div className="w-full md:w-1/2">
                <p className={`text-lg mb-6 ${darkMode ? 'text-slate-300' : 'text-slate-700'}`}>
                  I bring a unique combination of technical data science expertise and hands-on marketing experience, allowing me to:
                </p>
                
                <ul className="space-y-4">
                  <li className="flex items-start gap-3">
                    <div className={`min-w-6 h-6 mt-0.5 rounded-full ${darkMode ? 'bg-blue-900 text-blue-400' : 'bg-blue-100 text-blue-600'} flex items-center justify-center`}>
                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M20 6 9 17l-5-5"/>
                      </svg>
                    </div>
                    <p className={darkMode ? 'text-slate-300' : 'text-slate-700'}>
                      <strong className="text-blue-500">Transform raw data</strong> into actionable marketing insights and strategies
                    </p>
                  </li>
                  
                  <li className="flex items-start gap-3">
                    <div className={`min-w-6 h-6 mt-0.5 rounded-full ${darkMode ? 'bg-blue-900 text-blue-400' : 'bg-blue-100 text-blue-600'} flex items-center justify-center`}>
                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M20 6 9 17l-5-5"/>
                      </svg>
                    </div>
                    <p className={darkMode ? 'text-slate-300' : 'text-slate-700'}>
                      <strong className="text-purple-500">Optimize marketing campaigns</strong> using predictive modeling and data analysis
                    </p>
                  </li>
                  
                  <li className="flex items-start gap-3">
                    <div className={`min-w-6 h-6 mt-0.5 rounded-full ${darkMode ? 'bg-blue-900 text-blue-400' : 'bg-blue-100 text-blue-600'} flex items-center justify-center`}>
                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M20 6 9 17l-5-5"/>
                      </svg>
                    </div>
                    <p className={darkMode ? 'text-slate-300' : 'text-slate-700'}>
                      <strong className="text-yellow-500">Build intelligent systems</strong> that automate decision-making and improve customer experiences
                    </p>
                  </li>
                  
                  <li className="flex items-start gap-3">
                    <div className={`min-w-6 h-6 mt-0.5 rounded-full ${darkMode ? 'bg-blue-900 text-blue-400' : 'bg-blue-100 text-blue-600'} flex items-center justify-center`}>
                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M20 6 9 17l-5-5"/>
                      </svg>
                    </div>
                    <p className={darkMode ? 'text-slate-300' : 'text-slate-700'}>
                      <strong className="text-green-500">Communicate technical concepts</strong> in accessible language for stakeholders at all levels
                    </p>
                  </li>
                </ul>
                
                <div className="mt-8">
                  <Link href="/about">
                    <Button variant="outline" className={`rounded-full ${darkMode ? 'border-slate-700 text-slate-300 hover:bg-slate-800' : 'border-slate-300 text-slate-700 hover:bg-slate-200'}`}>
                      Learn more about my approach <ChevronRight size={16} className="ml-1" />
                    </Button>
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Services Section */}
      <section id="services" className="py-20">
        <div className="container mx-auto px-4">
          <motion.h2 
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="text-4xl md:text-6xl font-bold mb-6 bg-gradient-to-r from-pink-500 to-blue-500 text-transparent bg-clip-text text-center"
          >
            MY SERVICES
          </motion.h2>
          
          <p className={`text-center max-w-3xl mx-auto mb-16 ${darkMode ? 'text-slate-400' : 'text-slate-600'}`}>
            Leveraging my dual expertise in data science and marketing to provide comprehensive, data-driven solutions for businesses of all sizes.
          </p>
          
          <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-4">
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.1 }}
              className={`relative group overflow-hidden rounded-xl ${darkMode ? 'bg-slate-900/50' : 'bg-white'} p-8 border ${darkMode ? 'border-slate-800' : 'border-slate-200'} hover:border-blue-500/30 transition-all`}
            >
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 to-blue-700 transform origin-left scale-x-0 group-hover:scale-x-100 transition-transform duration-300"></div>
              
              <div className={`text-blue-500 mb-4 ${darkMode ? 'group-hover:text-blue-400' : 'group-hover:text-blue-600'} transition-colors`}>
                <Database size={32} />
              </div>
              <h3 className="text-2xl font-bold mb-4">Data Analysis</h3>
              <p className={`${darkMode ? 'text-slate-400' : 'text-slate-600'} mb-6`}>
                I transform raw data into actionable insights using statistical methods and visualization techniques, helping businesses make informed decisions based on their data.
              </p>
              <Link href="/services#data-analysis">
                <Button variant="ghost" size="sm" className="gap-1">
                  Learn more <ChevronRight size={14} />
                </Button>
              </Link>
            </motion.div>
            
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.2 }}
              className={`relative group overflow-hidden rounded-xl ${darkMode ? 'bg-slate-900/50' : 'bg-white'} p-8 border ${darkMode ? 'border-slate-800' : 'border-slate-200'} hover:border-blue-500/30 transition-all`}
            >
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 to-blue-700 transform origin-left scale-x-0 group-hover:scale-x-100 transition-transform duration-300"></div>
              
              <div className={`text-blue-500 mb-4 ${darkMode ? 'group-hover:text-blue-400' : 'group-hover:text-blue-600'} transition-colors`}>
                <Code size={32} />
              </div>
              <h3 className="text-2xl font-bold mb-4">Machine Learning</h3>
              <p className={`${darkMode ? 'text-slate-400' : 'text-slate-600'} mb-6`}>
                I develop custom machine learning models that can predict trends, classify data, and provide valuable insights from your datasets, enhancing decision-making processes.
              </p>
              <Link href="/services#machine-learning">
                <Button variant="ghost" size="sm" className="gap-1">
                  Learn more <ChevronRight size={14} />
                </Button>
              </Link>
            </motion.div>
            
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.3 }}
              className={`relative group overflow-hidden rounded-xl ${darkMode ? 'bg-slate-900/50' : 'bg-white'} p-8 border ${darkMode ? 'border-slate-800' : 'border-slate-200'} hover:border-blue-500/30 transition-all`}
            >
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 to-blue-700 transform origin-left scale-x-0 group-hover:scale-x-100 transition-transform duration-300"></div>
              
              <div className={`text-blue-500 mb-4 ${darkMode ? 'group-hover:text-blue-400' : 'group-hover:text-blue-600'} transition-colors`}>
                <LineChart size={32} />
              </div>
              <h3 className="text-2xl font-bold mb-4">Time Series Forecasting</h3>
              <p className={`${darkMode ? 'text-slate-400' : 'text-slate-600'} mb-6`}>
                I specialize in analyzing time-based data to predict future values, helping businesses anticipate demand, optimize resources, and plan effectively.
              </p>
              <Link href="/services#forecasting">
                <Button variant="ghost" size="sm" className="gap-1">
                  Learn more <ChevronRight size={14} />
                </Button>
              </Link>
            </motion.div>
            
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.4 }}
              className={`relative group overflow-hidden rounded-xl ${darkMode ? 'bg-slate-900/50' : 'bg-white'} p-8 border ${darkMode ? 'border-slate-800' : 'border-slate-200'} hover:border-purple-500/30 transition-all`}
            >
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-purple-500 to-purple-700 transform origin-left scale-x-0 group-hover:scale-x-100 transition-transform duration-300"></div>
              
              <div className={`text-purple-500 mb-4 ${darkMode ? 'group-hover:text-purple-400' : 'group-hover:text-purple-600'} transition-colors`}>
                <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-megaphone"><path d="m3 11 18-5v12L3 13v-2z"/><path d="M11.6 16.8a3 3 0 1 1-5.8-1.6"/></svg>
              </div>
              <h3 className="text-2xl font-bold mb-4">Digital Marketing</h3>
              <p className={`${darkMode ? 'text-slate-400' : 'text-slate-600'} mb-6`}>
                I leverage my experience as a Marketing Manager to create data-driven marketing strategies, optimize online presence, and deliver engaging content that drives measurable business growth.
              </p>
              <Link href="/services#marketing">
                <Button variant="ghost" size="sm" className="gap-1">
                  Learn more <ChevronRight size={14} />
                </Button>
              </Link>
            </motion.div>
          </div>
          
          {/* Testimonial */}
          <div className={`mt-20 p-8 rounded-xl ${darkMode ? 'bg-slate-900/50' : 'bg-white'} ${darkMode ? 'border border-slate-800' : 'shadow-lg'}`}>
            <div className="flex flex-col md:flex-row gap-8 items-center">
              <div className="w-full md:w-1/3">
                <div className="w-24 h-24 rounded-full mx-auto bg-gradient-to-r from-blue-500 to-purple-500 flex items-center justify-center text-white text-3xl font-bold">
                  TC
                </div>
                <div className="text-center mt-4">
                  <h4 className="font-bold">Thip Chaiyasit</h4>
                  <p className={`text-sm ${darkMode ? 'text-slate-400' : 'text-slate-600'}`}>Owner, Asian Street by Thai</p>
                </div>
              </div>
              
              <div className="w-full md:w-2/3">
                <svg className={`w-10 h-10 mb-4 ${darkMode ? 'text-slate-700' : 'text-slate-300'}`} fill="currentColor" viewBox="0 0 24 24">
                  <path d="M14.017 21v-7.391c0-5.704 3.731-9.57 8.983-10.609l.995 2.151c-2.432.917-3.995 3.638-3.995 5.849h4v10h-9.983zm-14.017 0v-7.391c0-5.704 3.748-9.57 9-10.609l.996 2.151c-2.433.917-3.996 3.638-3.996 5.849h3.983v10h-9.983z" />
                </svg>
                <p className={`text-lg italic mb-4 ${darkMode ? 'text-slate-300' : 'text-slate-700'}`}>
                  "Mikaeel's unique combination of data science and marketing expertise was invaluable to our business. His ability to analyze customer data and translate it into effective marketing strategies led to a 40% increase in our online order volume."
                </p>
                <div className="flex">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <svg key={star} className="w-5 h-5 text-yellow-500" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                    </svg>
                  ))}
                </div>
              </div>
            </div>
            
            <div className="flex justify-center mt-8">
              <Button variant="outline" size="sm" className="mx-1 rounded-full w-2 h-2 p-0"></Button>
              <Button variant="default" size="sm" className="mx-1 rounded-full w-2 h-2 p-0"></Button>
              <Button variant="outline" size="sm" className="mx-1 rounded-full w-2 h-2 p-0"></Button>
            </div>
          </div>
        </div>
      </section>

      {/* Marketing Experience Section */}
      <section id="experience" className="py-20 bg-gradient-to-br from-purple-500/5 to-blue-500/5">
        <div className="container mx-auto px-4">
          <motion.h2 
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="text-4xl md:text-6xl font-bold mb-16 bg-gradient-to-r from-purple-500 to-pink-500 text-transparent bg-clip-text text-center"
          >
            MARKETING EXPERIENCE
          </motion.h2>
          
          <div className={`${darkMode ? 'bg-slate-900/50' : 'bg-white'} rounded-xl overflow-hidden border ${darkMode ? 'border-slate-800' : 'border-slate-200'}`}>
            <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-slate-800">
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.1 }}
                className="p-8 relative group"
              >
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-purple-500 to-pink-500 transform scale-x-0 group-hover:scale-x-100 transition-transform duration-300"></div>
                <div className="flex items-start mb-6">
                  <div className="text-purple-500 mr-4">
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-briefcase"><rect width="20" height="14" x="2" y="7" rx="2" ry="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>
                  </div>
                  <div>
                    <h3 className="text-xl font-bold mb-1">Marketing Manager</h3>
                    <p className={`${darkMode ? 'text-slate-400' : 'text-slate-600'}`}>Asian Street by Thai</p>
                    <p className={`text-sm ${darkMode ? 'text-slate-500' : 'text-slate-500'}`}>Sep 2022 - Sep 2024</p>
                  </div>
                </div>
                <ul className={`${darkMode ? 'text-slate-300' : 'text-slate-700'} space-y-2 text-sm pl-4`}>
                  <li>Built and scaled the restaurant's full online presence</li>
                  <li>Produced high-impact visual content and managed ad campaigns</li>
                  <li>Leveraged analytics to track performance and optimize strategies</li>
                </ul>
                
                <div className="mt-6 space-x-2">
                  <span className={`inline-block px-2 py-1 text-xs rounded-full ${darkMode ? 'bg-purple-900/50 text-purple-300' : 'bg-purple-100 text-purple-700'}`}>
                    Social Media
                  </span>
                  <span className={`inline-block px-2 py-1 text-xs rounded-full ${darkMode ? 'bg-pink-900/50 text-pink-300' : 'bg-pink-100 text-pink-700'}`}>
                    SEO
                  </span>
                  <span className={`inline-block px-2 py-1 text-xs rounded-full ${darkMode ? 'bg-indigo-900/50 text-indigo-300' : 'bg-indigo-100 text-indigo-700'}`}>
                    Analytics
                  </span>
                </div>
              </motion.div>
              
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.2 }}
                className="p-8 relative group"
              >
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-purple-500 to-pink-500 transform scale-x-0 group-hover:scale-x-100 transition-transform duration-300"></div>
                <div className="flex items-start mb-6">
                  <div className="text-purple-500 mr-4">
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-briefcase"><rect width="20" height="14" x="2" y="7" rx="2" ry="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>
                  </div>
                  <div>
                    <h3 className="text-xl font-bold mb-1">Marketing Intern</h3>
                    <p className={`${darkMode ? 'text-slate-400' : 'text-slate-600'}`}>Impression Spa</p>
                    <p className={`text-sm ${darkMode ? 'text-slate-500' : 'text-slate-500'}`}>May 2024 - Jun 2024</p>
                  </div>
                </div>
                <ul className={`${darkMode ? 'text-slate-300' : 'text-slate-700'} space-y-2 text-sm pl-4`}>
                  <li>Developed and executed digital marketing strategy</li>
                  <li>Created and managed engaging content across social platforms</li>
                  <li>Leveraged analytics to enhance brand reputation</li>
                </ul>
                
                <div className="mt-6 space-x-2">
                  <span className={`inline-block px-2 py-1 text-xs rounded-full ${darkMode ? 'bg-purple-900/50 text-purple-300' : 'bg-purple-100 text-purple-700'}`}>
                    Content Creation
                  </span>
                  <span className={`inline-block px-2 py-1 text-xs rounded-full ${darkMode ? 'bg-pink-900/50 text-pink-300' : 'bg-pink-100 text-pink-700'}`}>
                    Digital Marketing
                  </span>
                </div>
              </motion.div>
              
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.3 }}
                className="p-8 relative group"
              >
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-purple-500 to-pink-500 transform scale-x-0 group-hover:scale-x-100 transition-transform duration-300"></div>
                <div className="flex items-start mb-6">
                  <div className="text-purple-500 mr-4">
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-briefcase"><rect width="20" height="14" x="2" y="7" rx="2" ry="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>
                  </div>
                  <div>
                    <h3 className="text-xl font-bold mb-1">Marketing Intern</h3>
                    <p className={`${darkMode ? 'text-slate-400' : 'text-slate-600'}`}>Resivation Hotel</p>
                    <p className={`text-sm ${darkMode ? 'text-slate-500' : 'text-slate-500'}`}>Oct 2023 - Dec 2023</p>
                  </div>
                </div>
                <ul className={`${darkMode ? 'text-slate-300' : 'text-slate-700'} space-y-2 text-sm pl-4`}>
                  <li>Produced and edited engaging social media content</li>
                  <li>Executed campaigns across key platforms</li>
                  <li>Assisted in SEO and Google My Business optimization</li>
                </ul>
                
                <div className="mt-6 space-x-2">
                  <span className={`inline-block px-2 py-1 text-xs rounded-full ${darkMode ? 'bg-purple-900/50 text-purple-300' : 'bg-purple-100 text-purple-700'}`}>
                    Social Media
                  </span>
                  <span className={`inline-block px-2 py-1 text-xs rounded-full ${darkMode ? 'bg-pink-900/50 text-pink-300' : 'bg-pink-100 text-pink-700'}`}>
                    SEO
                  </span>
                </div>
              </motion.div>
            </div>
            
            <div className={`p-6 ${darkMode ? 'bg-slate-900/80' : 'bg-slate-50'} text-center`}>
              <Link href="/experience">
                <Button variant="outline" className={`rounded-full ${darkMode ? 'border-purple-500/30 text-purple-400 hover:bg-purple-950/30 hover:text-purple-300' : 'border-purple-500/30 text-purple-700 hover:bg-purple-50 hover:text-purple-800'}`}>
                  View Full Experience <ChevronRight size={16} className="ml-1" />
                </Button>
              </Link>
            </div>
          </div>
          
          {/* Key achievements */}
          <div className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-8">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ delay: 0.1 }}
              className={`text-center p-6 rounded-xl ${darkMode ? 'bg-slate-900/50 border border-slate-800' : 'bg-white shadow-md'}`}
            >
              <div className="w-16 h-16 rounded-full mx-auto flex items-center justify-center bg-gradient-to-r from-purple-500 to-pink-500 text-white mb-4">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                </svg>
              </div>
              <h3 className="text-3xl font-bold mb-2">45K+</h3>
              <p className={`${darkMode ? 'text-slate-400' : 'text-slate-600'}`}>Followers gained across social media platforms</p>
            </motion.div>
            
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ delay: 0.2 }}
              className={`text-center p-6 rounded-xl ${darkMode ? 'bg-slate-900/50 border border-slate-800' : 'bg-white shadow-md'}`}
            >
              <div className="w-16 h-16 rounded-full mx-auto flex items-center justify-center bg-gradient-to-r from-purple-500 to-pink-500 text-white mb-4">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 20V10"/><path d="M18 20V4"/><path d="M6 20v-4"/>
                </svg>
              </div>
              <h3 className="text-3xl font-bold mb-2">32%</h3>
              <p className={`${darkMode ? 'text-slate-400' : 'text-slate-600'}`}>Increase in online visibility and customer engagement</p>
            </motion.div>
            
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ delay: 0.3 }}
              className={`text-center p-6 rounded-xl ${darkMode ? 'bg-slate-900/50 border border-slate-800' : 'bg-white shadow-md'}`}
            >
              <div className="w-16 h-16 rounded-full mx-auto flex items-center justify-center bg-gradient-to-r from-purple-500 to-pink-500 text-white mb-4">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/>
                </svg>
              </div>
              <h3 className="text-3xl font-bold mb-2">40%</h3>
              <p className={`${darkMode ? 'text-slate-400' : 'text-slate-600'}`}>Increase in online order volume through campaign optimization</p>
            </motion.div>
          </div>
        </div>
      </section>

      {/* World Records Section */}
      <section id="records" className="py-20 bg-slate-900 relative overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-yellow-500/20 to-transparent"></div>
          <div className="grid grid-cols-12 gap-4 opacity-20">
            {[...Array(48)].map((_, i) => (
              <div key={i} className="aspect-square bg-yellow-500/10 rounded-full"></div>
            ))}
          </div>
        </div>
        
        <div className="container mx-auto px-4 relative z-10">
          <div className="flex flex-col md:flex-row items-center md:items-start justify-between gap-12">
            <div className="md:w-1/2">


            <img
              src="/guinness.svg"
              alt="Guinness World Records Logo"
              className="h-48 w-auto md:h-64 mb-6"
            />
              
              <motion.h2 
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                className="text-4xl md:text-5xl font-bold mb-6 text-white"
              >
                Achievements Beyond <br />
                <span className="bg-gradient-to-r from-yellow-400 to-amber-500 text-transparent bg-clip-text">Ordinary Limits</span>
              </motion.h2>
              
              <motion.p 
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.1 }}
                className="text-slate-300 mb-8"
              >
                Not just a data scientist, I'm also a proud holder of three official Guinness World Records, showcasing my dedication to excellence in everything I pursue.
              </motion.p>
              
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.2 }}
              >
                <Link href="/records">
                  <Button variant="outline" className="rounded-full border-yellow-500/30 text-yellow-400 hover:bg-yellow-950/30 hover:text-yellow-300">
                    View All Records <ChevronRight size={16} className="ml-1" />
                  </Button>
                </Link>
              </motion.div>
            </div>
            
            <div className="md:w-1/2">
              <div className="grid grid-cols-1 gap-6">
                <motion.div 
                  initial={{ opacity: 0, x: 20 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.1 }}
                  className="bg-slate-800/50 rounded-xl p-6 border border-slate-700 hover:border-yellow-500/30 transition-all"
                >
                  <div className="flex items-center gap-4 mb-3">
                    <div className="min-w-10 h-10 rounded-full bg-yellow-500/20 text-yellow-400 flex items-center justify-center">
                      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="10"/>
                        <path d="m16 8-8 8"/>
                        <path d="m8 8 8 8"/>
                      </svg>
                    </div>
                    <h3 className="text-xl font-bold text-white">Fastest time to type the alphabet on a touchscreen mobile phone</h3>
                  </div>
                  <div className="ml-14">
                    <span className="inline-block px-2 py-1 text-xs rounded-full bg-yellow-500/20 text-yellow-300">
                      Speed Record
                    </span>
                  </div>
                </motion.div>
                
                <motion.div 
                  initial={{ opacity: 0, x: 20 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.2 }}
                  className="bg-slate-800/50 rounded-xl p-6 border border-slate-700 hover:border-yellow-500/30 transition-all"
                >
                  <div className="flex items-center gap-4 mb-3">
                    <div className="min-w-10 h-10 rounded-full bg-yellow-500/20 text-yellow-400 flex items-center justify-center">
                      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="10"/>        
                        <path d="m16 8-8 8"/>
                        <path d="m8 8 8 8"/>
                      </svg>
                    </div>
                    <h3 className="text-xl font-bold text-white">Fastest time to type the alphabet on a touchscreen mobile phone (single hand)</h3>
                  </div>
                  <div className="ml-14">
                    <span className="inline-block px-2 py-1 text-xs rounded-full bg-yellow-500/20 text-yellow-300">
                      Dexterity Record
                    </span>
                  </div>
                </motion.div>
                
                <motion.div 
                  initial={{ opacity: 0, x: 20 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.3 }}
                  className="bg-slate-800/50 rounded-xl p-6 border border-slate-700 hover:border-yellow-500/30 transition-all"
                >
                  <div className="flex items-center gap-4 mb-3">
                    <div className="min-w-10 h-10 rounded-full bg-yellow-500/20 text-yellow-400 flex items-center justify-center">
                      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="10"/>
                        <path d="m16 8-8 8"/>
                        <path d="m8 8 8 8"/>
                      </svg>
                    </div>
                    <h3 className="text-xl font-bold text-white">Fastest Game of five cup tilt-a-cup</h3>
                  </div>
                  <div className="ml-14">
                    <span className="inline-block px-2 py-1 text-xs rounded-full bg-yellow-500/20 text-yellow-300">
                      Game Record
                    </span>
                  </div>
                </motion.div>
              </div>

              {/* World record trivia */}
              <div className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-6 mx-auto max-w-5xl">
                <motion.div 
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.1 }}
                  className="text-center"
                >
                  <div className="w-16 h-16 mx-auto rounded-full border-2 border-yellow-500 flex items-center justify-center mb-4">
                    <span className="text-2xl font-bold text-yellow-400">3</span>
                  </div>
                  <p className="text-slate-300">Official Guinness World Records</p>
                </motion.div>
                
                <motion.div 
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.2 }}
                  className="text-center"
                >
                  <div className="w-16 h-16 mx-auto rounded-full border-2 border-yellow-500 flex items-center justify-center mb-4">
                    <span className="text-2xl font-bold text-yellow-400">2</span>
                  </div>
                  <p className="text-slate-300">Featured in global media outlets</p>
                </motion.div>
                
                <motion.div 
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.3 }}
                  className="text-center"
                >
                  <div className="w-16 h-16 mx-auto rounded-full border-2 border-yellow-500 flex items-center justify-center mb-4">
                    <span className="text-2xl font-bold text-yellow-400">1</span>
                  </div>
                  <p className="text-slate-300">Ongoing attempt for a new record</p>
                </motion.div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Skills Section */}
      <section id="skills" className="py-20 bg-slate-950">
        <div className="container mx-auto px-4">
          <motion.h2 
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="text-4xl md:text-6xl font-bold mb-6 bg-gradient-to-r from-pink-500 to-purple-500 text-transparent bg-clip-text text-center"
          >
            SKILLS
          </motion.h2>
          
          <p className="text-center max-w-3xl mx-auto mb-16 text-slate-400">
            A versatile skill set combining technical data expertise and practical marketing experience to deliver comprehensive, data-driven solutions.
          </p>
          
          <div className="mb-16">
            <h3 className="text-2xl text-center mb-12 text-slate-300">
              The skills, tools and technologies I use:
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-12 mb-16">
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                className="bg-slate-900/50 rounded-xl p-8 border border-slate-800"
              >
                <h4 className="text-xl font-bold mb-6 text-blue-400">Technical Skills</h4>
                <div className="grid grid-cols-3 md:grid-cols-4 gap-6 justify-items-center">
                  <div className="w-16 h-16 flex items-center justify-center relative group">
                    <img src="/icons/python.svg" alt="Python" className="h-10 group-hover:scale-110 transition-transform" />
                    <p className="text-xs text-center absolute mt-16">Python</p>
                  </div>
                  
                  <div className="w-16 h-16 flex items-center justify-center relative group">
                    <img src="/icons/pandas.svg" alt="Pandas" className="h-10 group-hover:scale-110 transition-transform" />
                    <p className="text-xs text-center absolute mt-16">Pandas</p>
                  </div>
                  
                  <div className="w-16 h-16 flex items-center justify-center relative group">
                    <img src="/icons/sklearn.svg" alt="Scikit-Learn" className="h-10 group-hover:scale-110 transition-transform" />
                    <p className="text-xs text-center absolute mt-16">Scikit-Learn</p>
                  </div>
                  
                  <div className="w-16 h-16 flex items-center justify-center relative group">
                    <img src="/icons/tensorflow.svg" alt="TensorFlow" className="h-10 group-hover:scale-110 transition-transform" />
                    <p className="text-xs text-center absolute mt-16">TensorFlow</p>
                  </div>
                  
                  <div className="w-16 h-16 flex items-center justify-center relative group">
                    <img src="/icons/jupyter.svg" alt="Jupyter" className="h-10 group-hover:scale-110 transition-transform" />
                    <p className="text-xs text-center absolute mt-16">Jupyter</p>
                  </div>
                  
                  <div className="w-16 h-16 flex items-center justify-center relative group">
                    <img src="/icons/azure.svg" alt="Azure" className="h-10 group-hover:scale-110 transition-transform" />
                    <p className="text-xs text-center absolute mt-16">Azure</p>
                  </div>
                  
                  <div className="w-16 h-16 flex items-center justify-center relative group">
                    <img src="/icons/java.svg" alt="Java" className="h-10 group-hover:scale-110 transition-transform" />
                    <p className="text-xs text-center absolute mt-16">Java</p>
                  </div>
                  
                  <div className="w-16 h-16 flex items-center justify-center relative group">
                    <img src="/icons/cpp.svg" alt="C++" className="h-10 group-hover:scale-110 transition-transform" />
                    <p className="text-xs text-center absolute mt-16">C++</p>
                  </div>
                  
                  <div className="w-16 h-16 flex items-center justify-center relative group">
                    <img src="/icons/pyspark.svg" alt="PySpark" className="h-10 group-hover:scale-110 transition-transform" />
                    <p className="text-xs text-center absolute mt-16">PySpark</p>
                  </div>
                  
                  <div className="w-16 h-16 flex items-center justify-center relative group">
                    <img src="/icons/powerbi.svg" alt="Power BI" className="h-10 group-hover:scale-110 transition-transform" />
                    <p className="text-xs text-center absolute mt-16">Power BI</p>
                  </div>
                  
                  <div className="w-16 h-16 flex items-center justify-center relative group">
                    <img src="/icons/git.svg" alt="Git" className="h-10 group-hover:scale-110 transition-transform" />
                    <p className="text-xs text-center absolute mt-16">Git</p>
                  </div>
                </div>
              </motion.div>
              
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.2 }}
                className="bg-slate-900/50 rounded-xl p-8 border border-slate-800"
              >
                <h4 className="text-xl font-bold mb-6 text-purple-400">Marketing Skills</h4>
                <div className="grid grid-cols-3 md:grid-cols-4 gap-6 justify-items-center">
                  <div className="w-16 h-16 flex items-center justify-center relative group">
                    <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-purple-400 group-hover:scale-110 transition-transform">
                      <path d="M3 3v18h18"/>
                      <path d="m19 9-5 5-4-4-3 3"/>
                    </svg>
                    <p className="text-xs text-center absolute mt-16">Analytics</p>
                  </div>
                  
                  <div className="w-16 h-16 flex items-center justify-center relative group">
                    <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-purple-400 group-hover:scale-110 transition-transform">
                      <rect width="20" height="14" x="2" y="5" rx="2"/>
                      <line x1="2" x2="22" y1="10" y2="10"/>
                    </svg>
                    <p className="text-xs text-center absolute mt-16">Ads</p>
                  </div>
                  
                  <div className="w-16 h-16 flex items-center justify-center relative group">
                    <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-purple-400 group-hover:scale-110 transition-transform">
                      <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z"/>
                      <rect width="4" height="12" x="2" y="9"/>
                      <circle cx="4" cy="4" r="2"/>
                    </svg>
                    <p className="text-xs text-center absolute mt-16">Social</p>
                  </div>
                  
                  <div className="w-16 h-16 flex items-center justify-center relative group">
                    <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-purple-400 group-hover:scale-110 transition-transform">
                      <circle cx="12" cy="12" r="10"/>
                      <path d="m16 10-4 4-4-4"/>
                    </svg>
                    <p className="text-xs text-center absolute mt-16">SEO</p>
                  </div>
                  
                  <div className="w-16 h-16 flex items-center justify-center relative group">
                    <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-purple-400 group-hover:scale-110 transition-transform">
                      <path d="M5 3a2 2 0 0 0-2 2"/>
                      <path d="M19 3a2 2 0 0 1 2 2"/>
                      <path d="M21 19a2 2 0 0 1-2 2"/>
                      <path d="M5 21a2 2 0 0 1-2-2"/>
                      <path d="M9 3h1"/>
                      <path d="M9 21h1"/>
                      <path d="M14 3h1"/>
                      <path d="M14 21h1"/>
                      <path d="M3 9v1"/>
                      <path d="M21 9v1"/>
                      <path d="M3 14v1"/>
                      <path d="M21 14v1"/>
                    </svg>
                    <p className="text-xs text-center absolute mt-16">Content</p>
                  </div>
                  
                  <div className="w-16 h-16 flex items-center justify-center relative group">
                    <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-purple-400 group-hover:scale-110 transition-transform">
                      <path d="M19 5v14H5V5h14m0-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2z"/>
                      <path d="M12 9v6"/>
                      <path d="M9 12h6"/>
                    </svg>
                    <p className="text-xs text-center absolute mt-16">Google Ads</p>
                  </div>
                  
                  <div className="w-16 h-16 flex items-center justify-center relative group">
                    <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-purple-400 group-hover:scale-110 transition-transform">
                      <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/>
                    </svg>
                    <p className="text-xs text-center absolute mt-16">Social Media</p>
                  </div>
                  
                  <div className="w-16 h-16 flex items-center justify-center relative group">
                    <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-purple-400 group-hover:scale-110 transition-transform">
                      <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/>
                      <polyline points="14 2 14 8 20 8"/>
                    </svg>
                    <p className="text-xs text-center absolute mt-16">Content Strategy</p>
                  </div>
                  
                  <div className="w-16 h-16 flex items-center justify-center relative group">
                    <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-purple-400 group-hover:scale-110 transition-transform">
                      <path d="m9.06 11.9 8.07-8.06a2.85 2.85 0 1 1 4.03 4.03l-8.06 8.08"/>
                      <path d="M7.07 14.94c-1.66 0-3 1.35-3 3.02 0 1.33-2.5 1.52-2 2.02 1.08 1.1 2.49 2.02 4 2.02 2.2 0 4-1.8 4-4.04a3.01 3.01 0 0 0-3-3.02z"/>
                    </svg>
                    <p className="text-xs text-center absolute mt-16">Branding</p>
                  </div>
                </div>
              </motion.div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                className="bg-gradient-to-br from-blue-500/10 to-blue-500/5 p-4 rounded-lg"
              >
                <h4 className="font-semibold mb-2 text-blue-400">Data Science</h4>
                <p className="text-sm text-slate-300">Machine learning, predictive modeling, data visualization, and statistical analysis</p>
              </motion.div>
              
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.1 }}
                className="bg-gradient-to-br from-purple-500/10 to-purple-500/5 p-4 rounded-lg"
              >
                <h4 className="font-semibold mb-2 text-purple-400">Digital Marketing</h4>
                <p className="text-sm text-slate-300">Social media management, content creation, SEO optimization, and campaign analytics</p>
              </motion.div>
              
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.2 }}
                className="bg-gradient-to-br from-blue-500/10 to-blue-500/5 p-4 rounded-lg"
              >
                <h4 className="font-semibold mb-2 text-blue-400">Programming</h4>
                <p className="text-sm text-slate-300">Python, Java, C++, SQL, and developing full-stack applications</p>
              </motion.div>
              
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.3 }}
                className="bg-gradient-to-br from-purple-500/10 to-purple-500/5 p-4 rounded-lg"
              >
                <h4 className="font-semibold mb-2 text-purple-400">Brand Development</h4>
                <p className="text-sm text-slate-300">Brand identity creation, customer engagement, and building online presence</p>
              </motion.div>
            </div>
          </div>
        </div>
      </section>    

      {/* Featured Projects Section */}
      <section id="projects" className="py-20">
        <div className="container mx-auto px-4">
          <motion.h2 
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="text-4xl md:text-6xl font-bold mb-6 bg-gradient-to-r from-blue-500 to-purple-500 text-transparent bg-clip-text text-center"
          >
            FEATURED PROJECTS
          </motion.h2>
          
          <p className="text-center max-w-3xl mx-auto mb-16 text-slate-400">
            A selection of recent projects showcasing my expertise in data science, machine learning, and practical applications.
          </p>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-12">
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="bg-gradient-to-br from-slate-900 to-slate-950 rounded-xl overflow-hidden shadow-xl group"
            >
              <div className="relative">
                <img src="/projects/dunkin.png" alt="Dunkin Project" className="w-full h-80 object-contain" />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-900 to-transparent"></div>
                <div className="absolute bottom-0 left-0 p-6">
                  <span className="px-2 py-1 text-xs rounded-full bg-blue-500/20 text-blue-300 mb-2 inline-block">
                    Time Series Analysis
                  </span>
                  <h3 className="text-xl font-bold mb-1">Dunkin' Donuts Time Series Demand Forecast</h3>
                  <p className="text-slate-400 text-sm mb-2">Python, Pandas, Scikit-Learn, Prophet</p>
                </div>
              </div>
              <div className="p-6 pt-0">
                <Link href="/projects/dunkin-donuts">
                  <Button className="w-full rounded-full bg-blue-600 hover:bg-blue-700 group-hover:bg-blue-500 transition-colors">
                    View Details
                  </Button>
                </Link>
              </div>
            </motion.div>
            
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.1 }}
              className="bg-gradient-to-br from-slate-900 to-slate-950 rounded-xl overflow-hidden shadow-xl group"
            >
              <div className="relative">
                <img src="/projects/skyline.png" alt="Real Estate Project" className="w-full h-80 object-contain" />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-900 to-transparent"></div>
                <div className="absolute bottom-0 left-0 p-6">
                  <span className="px-2 py-1 text-xs rounded-full bg-green-500/20 text-green-300 mb-2 inline-block">
                    Machine Learning
                  </span>
                  <h3 className="text-xl font-bold mb-1">Real Estate Valuation Using Ensemble Learning</h3>
                  <p className="text-slate-400 text-sm mb-2">PySpark, XGBoost, Ensemble Models</p>
                </div>
              </div>
              <div className="p-6 pt-0">
                <Link href="/projects/real-estate">
                  <Button className="w-full rounded-full bg-green-600 hover:bg-green-700 group-hover:bg-green-500 transition-colors">
                    View Details
                  </Button>
                </Link>
              </div>
            </motion.div>
            
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.2 }}
              className="bg-gradient-to-br from-slate-900 to-slate-950 rounded-xl overflow-hidden shadow-xl group"
            >
              <div className="relative">
                <img src="/projects/reem-finance.png" alt="Reem Finance Project" className="w-full h-80 object-contain" />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-900 to-transparent"></div>
                <div className="absolute bottom-0 left-0 p-6">
                  <span className="px-2 py-1 text-xs rounded-full bg-purple-500/20 text-purple-300 mb-2 inline-block">
                    Data Engineering
                  </span>
                  <h3 className="text-xl font-bold mb-1">Data Lake Architecture for Reem Finance</h3>
                  <p className="text-slate-400 text-sm mb-2">Azure, Data Factory, Power BI</p>
                </div>
              </div>
              <div className="p-6 pt-0">
                <Link href="/projects/data-lake">
                  <Button className="w-full rounded-full bg-purple-600 hover:bg-purple-700 group-hover:bg-purple-500 transition-colors">
                    View Details
                  </Button>
                </Link>
              </div>
            </motion.div>
          </div>
          
          <div className="text-center">
            <Link href="/projects">
              <Button variant="outline" className="rounded-full border-slate-700 text-slate-300 hover:bg-slate-800 hover:text-white">
                View All Projects <ChevronRight size={16} className="ml-1" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Contact Section */}
      <section id="contact" className="py-20 bg-gradient-to-br from-slate-950 to-slate-900">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
            <div>
              <motion.h2 
                initial={{ opacity: 0 }}
                whileInView={{ opacity: 1 }}
                viewport={{ once: true }}
                className="text-4xl md:text-5xl font-bold mb-6 bg-gradient-to-r from-pink-500 to-blue-500 text-transparent bg-clip-text"
              >
                DO YOU HAVE A PROJECT<br />TO DISCUSS?
              </motion.h2>
              
              <p className="text-2xl font-light text-slate-300 mb-8">GET IN TOUCH</p>
              
              <div className="mb-8">
                <h3 className="text-xl font-semibold mb-4">CONTACT</h3>
                <a href="mailto:mikaeel2013@gmail.com" className="text-blue-400 hover:text-blue-300 transition-colors">
                  mikaeel2013@gmail.com
                </a>
              </div>
              
              <div>
                <h3 className="text-xl font-semibold mb-4">SOCIAL MEDIA</h3>
                <div className="flex space-x-4">
                  <a
                    href="https://www.linkedin.com/in/mikaeelf/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-slate-400 hover:text-white transition-colors group"
                  >
                    <div className="p-3 rounded-full bg-slate-800 group-hover:bg-blue-900 transition-colors">
                      <Linkedin size={20} />
                    </div>
                  </a>

                  <a
                    href="https://github.com/xdMikayu"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-slate-400 hover:text-white transition-colors group"
                  >
                    <div className="p-3 rounded-full bg-slate-800 group-hover:bg-slate-700 transition-colors">
                      <Github size={20} />
                    </div>
                  </a>

                  <a
                    href="https://instagram.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-slate-400 hover:text-white transition-colors group"
                  >
                    <div className="p-3 rounded-full bg-slate-800 group-hover:bg-purple-900 transition-colors">
                      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-instagram">
                        <rect width="20" height="20" x="2" y="2" rx="5" ry="5"/>
                        <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/>
                        <line x1="17.5" x2="17.51" y1="6.5" y2="6.5"/>
                      </svg>
                    </div>
                  </a>
                </div>
              </div>
              
              <div className="mt-12">
                <div className="bg-slate-900/30 rounded-xl p-6 border border-slate-800 backdrop-blur-sm">
                  <h3 className="text-lg font-semibold mb-4">Available For</h3>
                  <ul className="space-y-3">
                    <li className="flex items-start gap-3">
                      <div className="min-w-6 h-6 mt-0.5 rounded-full bg-blue-900/50 text-blue-400 flex items-center justify-center">
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M20 6 9 17l-5-5"/>
                        </svg>
                      </div>
                      <span className="text-slate-300">Data Analysis & Visualization Projects</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <div className="min-w-6 h-6 mt-0.5 rounded-full bg-purple-900/50 text-purple-400 flex items-center justify-center">
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M20 6 9 17l-5-5"/>
                        </svg>
                      </div>
                      <span className="text-slate-300">Digital Marketing Consulting</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <div className="min-w-6 h-6 mt-0.5 rounded-full bg-green-900/50 text-green-400 flex items-center justify-center">
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M20 6 9 17l-5-5"/>
                        </svg>
                      </div>
                      <span className="text-slate-300">Machine Learning Model Development</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <div className="min-w-6 h-6 mt-0.5 rounded-full bg-yellow-900/50 text-yellow-400 flex items-center justify-center">
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M20 6 9 17l-5-5"/>
                        </svg>
                      </div>
                      <span className="text-slate-300">Speaking Engagements & Workshops</span>
                    </li>
                  </ul>
                </div>
              </div>
            </div>
            
            <div className="bg-slate-900/50 rounded-xl p-8 border border-slate-800 backdrop-blur-sm">
              <h3 className="text-xl font-semibold mb-6">CONTACT FORM</h3>
              
              <form>
                <div className="mb-4">
                  <label htmlFor="name" className="block text-sm font-medium text-slate-300 mb-1">Name</label>
                  <input 
                    type="text" 
                    id="name" 
                    className="w-full p-3 rounded-md border border-slate-700 bg-slate-800/50 text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
                    placeholder="Your Name"
                  />
                </div>
                
                <div className="mb-4">
                  <label htmlFor="email" className="block text-sm font-medium text-slate-300 mb-1">Email</label>
                  <input 
                    type="email" 
                    id="email" 
                    className="w-full p-3 rounded-md border border-slate-700 bg-slate-800/50 text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
                    placeholder="Your Email"
                  />
                </div>
                
                <div className="mb-4">
                  <label htmlFor="project" className="block text-sm font-medium text-slate-300 mb-1">Project Type</label>
                  <select 
                    id="project" 
                    className="w-full p-3 rounded-md border border-slate-700 bg-slate-800/50 text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
                  >
                    <option value="">Select a Project Type</option>
                    <option value="data-analysis">Data Analysis</option>
                    <option value="machine-learning">Machine Learning</option>
                    <option value="digital-marketing">Digital Marketing</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                
                <div className="mb-6">
                  <label htmlFor="message" className="block text-sm font-medium text-slate-300 mb-1">Message</label>
                  <textarea 
                    id="message" 
                    rows={5} 
                    className="w-full p-3 rounded-md border border-slate-700 bg-slate-800/50 text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
                    placeholder="Tell me about your project"
                  ></textarea>
                </div>
                
                <Button className="w-full rounded-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 transition-all">
                  SEND MESSAGE
                </Button>
                
                <p className="text-sm text-slate-400 mt-4 text-center">
                  I typically respond within 24 hours
                </p>
              </form>
            </div>
          </div>

          {/* FAQ section */}
          <div className="mt-20">
            <h3 className="text-2xl font-bold mb-8 text-center">Frequently Asked Questions</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto">
              <div className="bg-slate-900/30 rounded-xl p-6 border border-slate-800">
                <h4 className="text-lg font-semibold mb-2">What services do you offer?</h4>
                <p className="text-slate-400">I offer data science solutions, machine learning model development, time series forecasting, and digital marketing strategy consulting.</p>
              </div>
              
              <div className="bg-slate-900/30 rounded-xl p-6 border border-slate-800">
                <h4 className="text-lg font-semibold mb-2">What is your typical project timeline?</h4>
                <p className="text-slate-400">Project timelines vary depending on complexity, but I typically deliver small projects within 1-2 weeks and larger projects within 4-6 weeks.</p>
              </div>
              
              <div className="bg-slate-900/30 rounded-xl p-6 border border-slate-800">
                <h4 className="text-lg font-semibold mb-2">Do you work remotely?</h4>
                <p className="text-slate-400">Yes, I work remotely with clients from all over the world, providing the same quality of service regardless of location.</p>
              </div>
              
              <div className="bg-slate-900/30 rounded-xl p-6 border border-slate-800">
                <h4 className="text-lg font-semibold mb-2">How do you handle data privacy?</h4>
                <p className="text-slate-400">I take data privacy very seriously and follow strict protocols to ensure all client data is handled securely and confidentially.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 bg-slate-950 border-t border-slate-900">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-12">
            <div className="md:col-span-2">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-10 h-10 rounded-full bg-blue-600 text-white flex items-center justify-center text-xl font-bold">
                  MF
                </div>
                <h2 className="text-xl font-bold text-white">Mikaeel Faraz</h2>
              </div>
              <p className="mb-4 text-slate-400">
                Computer Science student specializing in Big Data & AI, with a unique blend of technical expertise and marketing experience. World record holder with a passion for innovation.
              </p>
              <div className="flex gap-4">
                <a href="#" className="text-slate-500 hover:text-white transition-colors">
                  <Github size={20} />
                </a>
                <a href="#" className="text-slate-500 hover:text-white transition-colors">
                  <Linkedin size={20} />
                </a>
                <a href="#" className="text-slate-500 hover:text-white transition-colors">
                  <Mail size={20} />
                </a>
              </div>
            </div>
            
            <div>
              <h3 className="text-lg font-semibold text-white mb-4">Pages</h3>
              <ul className="space-y-2">
                <li><a href="#" className="text-slate-400 hover:text-white transition-colors">Home</a></li>
                <li><a href="/about" className="text-slate-400 hover:text-white transition-colors">About</a></li>
                <li><a href="/projects" className="text-slate-400 hover:text-white transition-colors">Projects</a></li>
                <li><a href="/experience" className="text-slate-400 hover:text-white transition-colors">Experience</a></li>
                <li><a href="/records" className="text-slate-400 hover:text-white transition-colors">World Records</a></li>
                <li><a href="/contact" className="text-slate-400 hover:text-white transition-colors">Contact</a></li>
              </ul>
            </div>
            
            <div>
              <h3 className="text-lg font-semibold text-white mb-4">Services</h3>
              <ul className="space-y-2">
                <li><a href="/services#data-analysis" className="text-slate-400 hover:text-white transition-colors">Data Analysis</a></li>
                <li><a href="/services#machine-learning" className="text-slate-400 hover:text-white transition-colors">Machine Learning</a></li>
                <li><a href="/services#forecasting" className="text-slate-400 hover:text-white transition-colors">Time Series Forecasting</a></li>
                <li><a href="/services#marketing" className="text-slate-400 hover:text-white transition-colors">Digital Marketing</a></li>
              </ul>
            </div>
          </div>
          
          <div className="pt-8 border-t border-slate-800 text-center">
            <p className="text-slate-500 text-sm">
              &copy; {new Date().getFullYear()} Mikaeel Faraz. All rights reserved.
            </p>
            <p className="text-slate-600 text-xs mt-2">
              Designed and developed by Mikaeel Faraz
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}  