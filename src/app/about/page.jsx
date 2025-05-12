'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { motion, useScroll, useTransform } from 'framer-motion';
import { 
  ArrowLeft,
  Calendar,
  Code,
  Database,
  Award,
  Target,
  Heart,
  Coffee,
  Zap,
  TrendingUp,
  Users,
  BookOpen,
  Download,
  ChevronRight,
  Quote,
  MapPin,
  Sparkles,
  CheckCircle,
  MessageSquare
} from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

// Timeline data
const timelineEvents = [
  {
    year: '2021',
    title: 'Started University',
    description: 'Began my Bachelor of Computer Science at University of Wollongong in Dubai',
    icon: <BookOpen size={20} />,
    category: 'education'
  },
  {
    year: '2022',
    title: 'Marketing Manager',
    description: 'Joined Asian Street by Thai as Marketing Manager, building their digital presence from scratch',
    icon: <Users size={20} />,
    category: 'career'
  },
  {
    year: '2023',
    title: 'First Software Projects',
    description: 'Developed seating allocation system for Dubai Transport and automobile sales management system',
    icon: <Code size={20} />,
    category: 'project'
  },
  {
    year: '2024',
    title: 'Marketing Internships',
    description: 'Gained experience at Impression Spa and Resivation Hotel, focusing on digital marketing strategies',
    icon: <TrendingUp size={20} />,
    category: 'career'
  },
  {
    year: '2024',
    title: 'World Records Achieved',
    description: 'Set three Guinness World Records, showcasing dedication to excellence beyond academics',
    icon: <Award size={20} />,
    category: 'achievement'
  },
  {
    year: '2024-25',
    title: 'Advanced Data Science Projects',
    description: 'Developed time series forecasting for Dunkin\' Donuts and real estate valuation models',
    icon: <Database size={20} />,
    category: 'project'
  },
  {
    year: '2025',
    title: 'Final Year & Career Focus',
    description: 'Completing degree while seeking opportunities to combine data science with marketing expertise',
    icon: <Target size={20} />,
    category: 'current'
  }
];

// Skills data with proficiency levels
const technicalSkills = [
  { name: 'Python', level: 90, category: 'Programming' },
  { name: 'Machine Learning', level: 85, category: 'Data Science' },
  { name: 'Data Analysis', level: 92, category: 'Data Science' },
  { name: 'Time Series Forecasting', level: 88, category: 'Data Science' },
  { name: 'Java', level: 80, category: 'Programming' },
  { name: 'C++', level: 75, category: 'Programming' },
  { name: 'SQL', level: 85, category: 'Database' },
  { name: 'PySpark', level: 78, category: 'Big Data' },
  { name: 'Power BI', level: 82, category: 'Visualization' },
  { name: 'Azure', level: 76, category: 'Cloud' }
];

const marketingSkills = [
  { name: 'Digital Marketing Strategy', level: 90 },
  { name: 'Social Media Management', level: 92 },
  { name: 'SEO Optimization', level: 85 },
  { name: 'Content Creation', level: 88 },
  { name: 'Campaign Analytics', level: 87 },
  { name: 'Brand Development', level: 83 },
  { name: 'Customer Engagement', level: 90 },
  { name: 'Google Ads', level: 82 }
];

const softSkills = [
  { name: 'Problem Solving', level: 95 },
  { name: 'Communication', level: 90 },
  { name: 'Leadership', level: 85 },
  { name: 'Critical Thinking', level: 92 },
  { name: 'Creativity', level: 88 },
  { name: 'Adaptability', level: 90 },
  { name: 'Time Management', level: 87 },
  { name: 'Team Collaboration', level: 85 }
];

// Fun facts data
const funFacts = [
  { label: 'World Records', value: '3', icon: <Award size={24} />, color: 'text-yellow-400' },
  { label: 'Projects Completed', value: '15+', icon: <Code size={24} />, color: 'text-blue-400' },
  { label: 'Social Media Followers Gained', value: '45K+', icon: <Users size={24} />, color: 'text-purple-400' },
  { label: 'Prediction Accuracy', value: '93%', icon: <Target size={24} />, color: 'text-green-400' },
  { label: 'Coffee Cups/Day', value: '3', icon: <Coffee size={24} />, color: 'text-orange-400' },
  { label: 'Online Courses Completed', value: '25+', icon: <BookOpen size={24} />, color: 'text-pink-400' },
  { label: 'Years of Experience', value: '3+', icon: <Calendar size={24} />, color: 'text-cyan-400' },
  { label: 'Client Satisfaction', value: '100%', icon: <Heart size={24} />, color: 'text-red-400' }
];

export default function AboutPage() {
  const [activeTab, setActiveTab] = useState('technical');
  const { scrollYProgress } = useScroll();
  const y1 = useTransform(scrollYProgress, [0, 1], [0, -100]);
  const y2 = useTransform(scrollYProgress, [0, 1], [0, -200]);
  
  // Animated counter component
  const AnimatedCounter = ({ value, suffix = '', duration = 2000 }) => {
    const [count, setCount] = useState(0);
    const endValue = parseInt(value.replace(/\D/g, ''));
    
    useEffect(() => {
      let startTime = null;
      const animate = (currentTime) => {
        if (!startTime) startTime = currentTime;
        const progress = Math.min((currentTime - startTime) / duration, 1);
        
        setCount(Math.floor(progress * endValue));
        
        if (progress < 1) {
          requestAnimationFrame(animate);
        }
      };
      
      requestAnimationFrame(animate);
    }, [endValue, duration]);
    
    return <span>{count}{suffix}</span>;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 to-slate-900 text-white">
      {/* Hero Section */}
      <section className="relative min-h-[70vh] flex items-center pt-24">
        <div className="absolute inset-0 overflow-hidden">
          <motion.div 
            style={{ y: y1 }}
            className="absolute top-0 left-1/4 w-72 h-72 bg-blue-500/10 rounded-full blur-3xl"
          />
          <motion.div 
            style={{ y: y2 }}
            className="absolute bottom-0 right-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl"
          />
        </div>
        
        <div className="container mx-auto px-4 relative z-10">
          <Link href="/" className="inline-flex items-center mb-8 text-slate-400 hover:text-blue-400 transition-colors">
            <ArrowLeft size={16} className="mr-2" /> Back to Home
          </Link>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
            <div>
              <motion.h1 
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                className="text-4xl md:text-6xl font-bold mb-6 bg-gradient-to-r from-blue-500 to-purple-500 text-transparent bg-clip-text"
              >
                The Story Behind the Code
              </motion.h1>
              
              <motion.p 
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.2 }}
                className="text-xl md:text-2xl text-slate-300 mb-6"
              >
                From marketing insights to machine learning models, I bridge the gap between business understanding and technical innovation.
              </motion.p>
              
              <motion.div 
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.4 }}
                className="flex flex-wrap gap-4"
              >
                <Badge className="px-4 py-2 bg-blue-500/20 text-blue-300 border-blue-500/30">
                  Data Scientist
                </Badge>
                <Badge className="px-4 py-2 bg-purple-500/20 text-purple-300 border-purple-500/30">
                  Marketing Expert
                </Badge>
                <Badge className="px-4 py-2 bg-yellow-500/20 text-yellow-300 border-yellow-500/30">
                  World Record Holder
                </Badge>
              </motion.div>
            </div>
            
            <div className="relative">
              <motion.div 
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.5, delay: 0.3 }}
                className="w-64 h-64 md:w-80 md:h-80 mx-auto"
              >
                <div className="w-full h-full rounded-full bg-gradient-to-r from-blue-600 to-purple-600 p-1">
                  <div className="w-full h-full rounded-full bg-slate-900 flex items-center justify-center">
                    <div className="text-6xl md:text-8xl font-bold bg-gradient-to-r from-blue-500 to-purple-500 text-transparent bg-clip-text">
                      MF
                    </div>
                  </div>
                </div>
                
                {/* Floating badges */}
                <motion.div 
                  animate={{ y: [0, -10, 0] }}
                  transition={{ repeat: Infinity, duration: 3 }}
                  className="absolute -top-4 -right-4 bg-yellow-500 text-white p-3 rounded-full shadow-lg"
                >
                  <Award size={24} />
                </motion.div>
                
                <motion.div 
                  animate={{ y: [0, 10, 0] }}
                  transition={{ repeat: Infinity, duration: 3, delay: 1 }}
                  className="absolute -bottom-4 -left-4 bg-blue-500 text-white p-3 rounded-full shadow-lg"
                >
                  <Code size={24} />
                </motion.div>
                
                <motion.div 
                  animate={{ y: [0, -10, 0] }}
                  transition={{ repeat: Infinity, duration: 3, delay: 2 }}
                  className="absolute top-1/2 -right-8 bg-purple-500 text-white p-3 rounded-full shadow-lg"
                >
                  <TrendingUp size={24} />
                </motion.div>
              </motion.div>
            </div>
          </div>
        </div>
      </section>
      
      {/* Personal Introduction */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="space-y-6"
            >
              <h2 className="text-3xl font-bold mb-8">Who I Am</h2>
              
              <p className="text-lg text-slate-300 leading-relaxed">
                I'm Mikaeel Faraz, a final-year Computer Science student at the University of Wollongong in Dubai, specializing in Big Data and AI. 
                What sets me apart is my unique journey from digital marketing to data science, bringing a rare combination of technical expertise 
                and business acumen to every project I undertake.
              </p>
              
              <p className="text-lg text-slate-300 leading-relaxed">
                My career began in marketing, where I spent over two years building and scaling digital presences for businesses in Dubai. 
                This experience gave me invaluable insights into consumer behavior, business metrics, and the importance of data-driven decision-making. 
                It's this understanding that now enriches my approach to data science – I don't just analyze data; I understand the business context behind it.
              </p>
              
              <p className="text-lg text-slate-300 leading-relaxed">
                Beyond academics and professional work, I'm also a three-time Guinness World Record holder. These achievements represent more than 
                just personal milestones – they reflect my commitment to excellence, precision, and pushing boundaries in everything I do. 
                Whether it's breaking a world record or building a machine learning model, I approach challenges with the same dedication to achieving extraordinary results.
              </p>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-12">
                <Card className="bg-slate-900/50 border-slate-800">
                  <CardContent className="p-6">
                    <Target className="w-12 h-12 text-blue-500 mb-4" />
                    <h3 className="text-xl font-bold mb-2">My Mission</h3>
                    <p className="text-slate-400">
                      To leverage data science and AI to solve real-world business problems, creating solutions that are both technically sound and commercially viable.
                    </p>
                  </CardContent>
                </Card>
                
                <Card className="bg-slate-900/50 border-slate-800">
                  <CardContent className="p-6">
                    <Zap className="w-12 h-12 text-purple-500 mb-4" />
                    <h3 className="text-xl font-bold mb-2">My Approach</h3>
                    <p className="text-slate-400">
                      I combine analytical rigor with creative problem-solving, ensuring that every solution is optimized for both technical performance and business impact.
                    </p>
                  </CardContent>
                </Card>
                
                <Card className="bg-slate-900/50 border-slate-800">
                  <CardContent className="p-6">
                    <Heart className="w-12 h-12 text-red-500 mb-4" />
                    <h3 className="text-xl font-bold mb-2">My Values</h3>
                    <p className="text-slate-400">
                      Integrity, continuous learning, and excellence guide everything I do. I believe in creating value through innovation and ethical practices.
                    </p>
                  </CardContent>
                </Card>
              </div>
            </motion.div>
          </div>
        </div>
      </section>
      
      {/* My Journey Timeline */}
      <section className="py-20 bg-slate-950/50">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl md:text-4xl font-bold mb-12 text-center bg-gradient-to-r from-blue-500 to-purple-500 text-transparent bg-clip-text">
            My Journey
          </h2>
          
          <div className="max-w-4xl mx-auto">
            <div className="relative">
              {/* Timeline line */}
              <div className="absolute left-1/2 transform -translate-x-1/2 w-0.5 h-full bg-gradient-to-b from-blue-500 to-purple-500"></div>
              
              {/* Timeline events */}
              {timelineEvents.map((event, index) => (
                <motion.div 
                  key={index}
                  initial={{ opacity: 0, x: index % 2 === 0 ? -50 : 50 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: index * 0.1 }}
                  className={`relative flex items-center mb-12 ${index % 2 === 0 ? 'justify-start' : 'justify-end'}`}
                >
                  <div className={`w-5/12 ${index % 2 === 0 ? 'text-right pr-8' : 'text-left pl-8'}`}>
                    <div className={`inline-block p-6 rounded-xl bg-slate-900 border border-slate-800 ${
                      event.category === 'achievement' ? 'border-yellow-500/30' : 
                      event.category === 'career' ? 'border-purple-500/30' : 
                      event.category === 'education' ? 'border-blue-500/30' : 
                      event.category === 'project' ? 'border-green-500/30' : 
                      'border-cyan-500/30'
                    }`}>
                      <div className="flex items-center gap-3 mb-2">
                        <div className={`p-2 rounded-full ${
                          event.category === 'achievement' ? 'bg-yellow-500/20 text-yellow-400' : 
                          event.category === 'career' ? 'bg-purple-500/20 text-purple-400' : 
                          event.category === 'education' ? 'bg-blue-500/20 text-blue-400' : 
                          event.category === 'project' ? 'bg-green-500/20 text-green-400' : 
                          'bg-cyan-500/20 text-cyan-400'
                        }`}>
                          {event.icon}
                        </div>
                        <span className="text-sm font-medium text-slate-400">{event.year}</span>
                      </div>
                      <h3 className="text-xl font-bold mb-2">{event.title}</h3>
                      <p className="text-slate-400">{event.description}</p>
                    </div>
                  </div>
                  
                  {/* Center dot */}
                  <div className="absolute left-1/2 transform -translate-x-1/2 w-4 h-4 bg-white rounded-full border-4 border-slate-900 z-10"></div>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </section>
      
      {/* What Makes Me Different */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl md:text-4xl font-bold mb-12 text-center bg-gradient-to-r from-purple-500 to-pink-500 text-transparent bg-clip-text">
            What Makes Me Different
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto">
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.1 }}
              className="text-center"
            >
              <div className="w-24 h-24 mx-auto mb-6 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-full flex items-center justify-center">
                <Code size={40} className="text-white" />
              </div>
              <h3 className="text-2xl font-bold mb-4">Technical Excellence</h3>
              <p className="text-slate-300">
                Proficient in Python, machine learning, and data engineering. I build robust solutions that scale 
                and deliver measurable results, from predictive models to real-time analytics systems.
              </p>
            </motion.div>
            
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.2 }}
              className="text-center"
            >
              <div className="w-24 h-24 mx-auto mb-6 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full flex items-center justify-center">
                <TrendingUp size={40} className="text-white" />
              </div>
              <h3 className="text-2xl font-bold mb-4">Marketing Insight</h3>
              <p className="text-slate-300">
                With hands-on experience managing digital marketing campaigns and building brand presence, 
                I understand the business context behind data and can translate insights into actionable strategies.
              </p>
            </motion.div>
            
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.3 }}
              className="text-center"
            >
              <div className="w-24 h-24 mx-auto mb-6 bg-gradient-to-r from-yellow-500 to-orange-500 rounded-full flex items-center justify-center">
                <Award size={40} className="text-white" />
              </div>
              <h3 className="text-2xl font-bold mb-4">Record-Breaking Mindset</h3>
              <p className="text-slate-300">
                Three Guinness World Records demonstrate my commitment to excellence and ability to achieve 
                extraordinary results through dedication, precision, and innovative thinking.
              </p>
            </motion.div>
          </div>
        </div>
      </section>
      
      {/* Skills Deep Dive */}
      <section className="py-20 bg-slate-950/50">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl md:text-4xl font-bold mb-12 text-center">
            Skills & Expertise
          </h2>
          
          <Tabs value={activeTab} onValueChange={setActiveTab} className="max-w-4xl mx-auto">
            <TabsList className="grid w-full grid-cols-3 bg-slate-900">
              <TabsTrigger value="technical">Technical Skills</TabsTrigger>
              <TabsTrigger value="marketing">Marketing Skills</TabsTrigger>
              <TabsTrigger value="soft">Soft Skills</TabsTrigger>
            </TabsList>
            
            <TabsContent value="technical" className="mt-8">
              <div className="space-y-6">
                {technicalSkills.map((skill, index) => (
                  <motion.div 
                    key={index}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.05 }}
                  >
                    <div className="flex justify-between mb-2">
                      <span className="font-medium">{skill.name}</span>
                      <span className="text-sm text-slate-400">{skill.level}%</span>
                    </div>
                    <Progress value={skill.level} className="h-2" />
                    <span className="text-xs text-slate-500 mt-1">{skill.category}</span>
                  </motion.div>
                ))}
              </div>
            </TabsContent>
            
            <TabsContent value="marketing" className="mt-8">
              <div className="space-y-6">
                {marketingSkills.map((skill, index) => (
                  <motion.div 
                    key={index}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.05 }}
                  >
                    <div className="flex justify-between mb-2">
                      <span className="font-medium">{skill.name}</span>
                      <span className="text-sm text-slate-400">{skill.level}%</span>
                    </div>
                    <Progress value={skill.level} className="h-2" indicatorClassName="bg-purple-500" />
                  </motion.div>
                ))}
              </div>
            </TabsContent>
            
            <TabsContent value="soft" className="mt-8">
              <div className="space-y-6">
                {softSkills.map((skill, index) => (
                  <motion.div 
                    key={index}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.05 }}
                  >
                    <div className="flex justify-between mb-2">
                      <span className="font-medium">{skill.name}</span>
                      <span className="text-sm text-slate-400">{skill.level}%</span>
                    </div>
                    <Progress value={skill.level} className="h-2" indicatorClassName="bg-green-500" />
                  </motion.div>
                ))}
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </section>
      
      {/* World Records Showcase */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl md:text-4xl font-bold mb-12 text-center bg-gradient-to-r from-yellow-500 to-orange-500 text-transparent bg-clip-text">
            Guinness World Records
          </h2>
          
          <div className="max-w-4xl mx-auto">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-12">
              <Card className="bg-slate-900 border-yellow-500/30 hover:shadow-yellow-500/20 hover:shadow-lg transition-all">
                <CardContent className="p-6 text-center">
                  <div className="w-16 h-16 mx-auto mb-4 bg-yellow-500/20 rounded-full flex items-center justify-center">
                    <Award size={32} className="text-yellow-500" />
                  </div>
                  <h3 className="text-xl font-bold mb-2">Speed Typing Champion</h3>
                  <p className="text-slate-400 mb-4">Fastest time to type the alphabet on a touchscreen mobile phone</p>
                  <Badge className="bg-yellow-500/20 text-yellow-300 border-yellow-500/30">
                    World Record
                  </Badge>
                </CardContent>
              </Card>
              
              <Card className="bg-slate-900 border-yellow-500/30 hover:shadow-yellow-500/20 hover:shadow-lg transition-all">
                <CardContent className="p-6 text-center">
                  <div className="w-16 h-16 mx-auto mb-4 bg-yellow-500/20 rounded-full flex items-center justify-center">
                    <Award size={32} className="text-yellow-500" />
                  </div>
                  <h3 className="text-xl font-bold mb-2">Single-Hand Master</h3>
                  <p className="text-slate-400 mb-4">Fastest time to type the alphabet on a touchscreen (single hand)</p>
                  <Badge className="bg-yellow-500/20 text-yellow-300 border-yellow-500/30">
                    World Record
                  </Badge>
                </CardContent>
              </Card>
              
              <Card className="bg-slate-900 border-yellow-500/30 hover:shadow-yellow-500/20 hover:shadow-lg transition-all">
                <CardContent className="p-6 text-center">
                  <div className="w-16 h-16 mx-auto mb-4 bg-yellow-500/20 rounded-full flex items-center justify-center">
                    <Award size={32} className="text-yellow-500" />
                  </div>
                  <h3 className="text-xl font-bold mb-2">Gaming Excellence</h3>
                  <p className="text-slate-400 mb-4">Fastest game of five cup tilt-a-cup</p>
                  <Badge className="bg-yellow-500/20 text-yellow-300 border-yellow-500/30">
                    World Record
                  </Badge>
                </CardContent>
              </Card>
            </div>
            
            <div className="bg-slate-900/50 rounded-xl p-8 border border-slate-800">
              <h3 className="text-2xl font-bold mb-6 text-center">The Story Behind the Records</h3>
              <p className="text-lg text-slate-300 leading-relaxed mb-6">
                Achieving these world records wasn't just about breaking boundaries – it was about proving that with dedication, 
                precision, and innovative thinking, anything is possible. Each record required months of preparation, analysis of 
                techniques, and relentless practice.
              </p>
              <p className="text-lg text-slate-300 leading-relaxed">
                These achievements reflect the same mindset I bring to my professional work: a commitment to excellence, 
                attention to detail, and the determination to push beyond conventional limits. Whether I'm optimizing a machine 
                learning model or attempting a world record, I approach challenges with data-driven strategies and unwavering focus.
              </p>
              
              <div className="grid grid-cols-3 gap-6 mt-8">
                <div className="text-center">
                  <Sparkles className="w-8 h-8 mx-auto mb-2 text-yellow-500" />
                  <h4 className="font-bold">Precision</h4>
                  <p className="text-sm text-slate-400">Every millisecond counted</p>
                </div>
                <div className="text-center">
                  <Zap className="w-8 h-8 mx-auto mb-2 text-yellow-500" />
                  <h4 className="font-bold">Speed</h4>
                  <p className="text-sm text-slate-400">Optimized for performance</p>
                </div>
                <div className="text-center">
                  <Target className="w-8 h-8 mx-auto mb-2 text-yellow-500" />
                  <h4 className="font-bold">Focus</h4>
                  <p className="text-sm text-slate-400">Unwavering determination</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
      
      {/* Values & Work Philosophy */}
      <section className="py-20 bg-slate-950/50">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl md:text-4xl font-bold mb-12 text-center">
            Values & Work Philosophy
          </h2>
          
          <div className="max-w-6xl mx-auto">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <motion.div 
                initial={{ opacity: 0, x: -20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                className="space-y-6"
              >
                <Card className="bg-slate-900 border-slate-800">
                  <CardContent className="p-6">
                    <CheckCircle className="w-10 h-10 text-green-500 mb-4" />
                    <h3 className="text-xl font-bold mb-3">Data-Driven Decision Making</h3>
                    <p className="text-slate-300">
                      I believe in letting data tell the story. Every decision should be backed by solid evidence and thorough analysis, 
                      ensuring optimal outcomes and minimizing risks.
                    </p>
                  </CardContent>
                </Card>
                
                <Card className="bg-slate-900 border-slate-800">
                  <CardContent className="p-6">
                    <Users className="w-10 h-10 text-blue-500 mb-4" />
                    <h3 className="text-xl font-bold mb-3">Collaborative Innovation</h3>
                    <p className="text-slate-300">
                      The best solutions come from diverse perspectives. I thrive in collaborative environments where ideas are shared 
                      freely and innovation is encouraged.
                    </p>
                  </CardContent>
                </Card>
              </motion.div>
              
              <motion.div 
                initial={{ opacity: 0, x: 20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                className="space-y-6"
              >
                <Card className="bg-slate-900 border-slate-800">
                  <CardContent className="p-6">
                    <BookOpen className="w-10 h-10 text-purple-500 mb-4" />
                    <h3 className="text-xl font-bold mb-3">Continuous Learning</h3>
                    <p className="text-slate-300">
                      Technology evolves rapidly, and so do I. I'm committed to staying at the forefront of data science and AI, 
                      constantly expanding my knowledge and skills.
                    </p>
                  </CardContent>
                </Card>
                
                <Card className="bg-slate-900 border-slate-800">
                  <CardContent className="p-6">
                    <Heart className="w-10 h-10 text-red-500 mb-4" />
                    <h3 className="text-xl font-bold mb-3">Ethical Responsibility</h3>
                    <p className="text-slate-300">
                      With great power comes great responsibility. I'm committed to using AI and data science ethically, 
                      ensuring privacy, fairness, and transparency in all my work.
                    </p>
                  </CardContent>
                </Card>
              </motion.div>
            </div>
            
            <div className="mt-12 text-center">
              <Quote className="w-12 h-12 mx-auto mb-6 text-slate-500" />
              <blockquote className="text-2xl italic text-slate-300 max-w-3xl mx-auto">
                "The intersection of technology and business understanding is where true innovation happens. 
                My goal is to bridge that gap, creating solutions that are not just technically advanced but also commercially impactful."
              </blockquote>
              <p className="mt-4 text-slate-500">- Mikaeel Faraz</p>
            </div>
          </div>
        </div>
      </section>
      
      {/* Hobbies & Interests */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl md:text-4xl font-bold mb-12 text-center">
            Beyond the Code
          </h2>
          
          <div className="max-w-4xl mx-auto">
            <p className="text-lg text-slate-300 text-center mb-12">
              When I'm not immersed in data science or breaking world records, I enjoy activities that keep me curious, 
              creative, and connected to the world around me.
            </p>
            
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                className="text-center"
              >
                <div className="w-20 h-20 mx-auto mb-4 bg-blue-500/20 rounded-full flex items-center justify-center">
                  <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-blue-400">
                    <path d="M14 3v4a1 1 0 0 0 1 1h4"/>
                    <path d="M17 21H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7l5 5v11a2 2 0 0 1-2 2z"/>
                    <path d="M9 9h1"/>
                    <path d="M9 13h6"/>
                    <path d="M9 17h6"/>
                  </svg>
                </div>
                <h3 className="font-bold mb-2">Tech Blogging</h3>
                <p className="text-sm text-slate-400">Writing about AI trends and sharing project insights</p>
              </motion.div>
              
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.1 }}
                className="text-center"
              >
                <div className="w-20 h-20 mx-auto mb-4 bg-purple-500/20 rounded-full flex items-center justify-center">
                  <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-purple-400">
                    <circle cx="12" cy="12" r="10"/>
                    <path d="M8 12h8"/>
                    <path d="m12 8 4 4-4 4"/>
                  </svg>
                </div>
                <h3 className="font-bold mb-2">Gaming</h3>
                <p className="text-sm text-slate-400">Strategy games that challenge problem-solving skills</p>
              </motion.div>
              
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.2 }}
                className="text-center"
              >
                <div className="w-20 h-20 mx-auto mb-4 bg-green-500/20 rounded-full flex items-center justify-center">
                  <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-green-400">
                    <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/>
                    <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/>
                    <path d="M4 22h16"/>
                    <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/>
                    <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/>
                    <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/>
                  </svg>
                </div>
                <h3 className="font-bold mb-2">Fitness</h3>
                <p className="text-sm text-slate-400">Maintaining physical and mental well-being</p>
              </motion.div>
              
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.3 }}
                className="text-center"
              >
                <div className="w-20 h-20 mx-auto mb-4 bg-orange-500/20 rounded-full flex items-center justify-center">
                  <Coffee size={40} className="text-orange-400" />
                </div>
                <h3 className="font-bold mb-2">Coffee Culture</h3>
                <p className="text-sm text-slate-400">Exploring Dubai's vibrant coffee scene</p>
              </motion.div>
            </div>
          </div>
        </div>
      </section>
      
      {/* Fun Facts */}
      <section className="py-20 bg-slate-950/50">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl md:text-4xl font-bold mb-12 text-center">
            Quick Stats
          </h2>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 max-w-6xl mx-auto">
            {funFacts.map((fact, index) => (
              <motion.div 
                key={index}
                initial={{ opacity: 0, scale: 0.9 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
                className="text-center"
              >
                <Card className="bg-slate-900 border-slate-800 hover:border-slate-700 transition-colors">
                  <CardContent className="p-6">
                    <div className={`w-12 h-12 mx-auto mb-3 ${fact.color}`}>
                      {fact.icon}
                    </div>
                    <h3 className="text-3xl font-bold mb-1">
                      {fact.value.includes('+') || fact.value.includes('%') ? (
                        <AnimatedCounter value={fact.value} suffix={fact.value.includes('+') ? '+' : '%'} />
                      ) : (
                        fact.value
                      )}
                    </h3>
                    <p className="text-sm text-slate-400">{fact.label}</p>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>
      
      {/* Testimonials */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl md:text-4xl font-bold mb-12 text-center">
            What Others Say
          </h2>
          
          <div className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-8">
            <Card className="bg-slate-900 border-slate-800">
              <CardContent className="p-6">
                <Quote className="w-8 h-8 text-slate-600 mb-4" />
                <p className="text-slate-300 mb-6">
                  "Mikaeel's unique combination of data science expertise and marketing knowledge was invaluable to our business. 
                  His insights led to a 40% increase in our online order volume."
                </p>
                <div className="flex items-center">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-r from-blue-500 to-purple-500 flex items-center justify-center text-white font-bold mr-3">
                    AC
                  </div>
                  <div>
                    <p className="font-bold">Ahmad Chaudhry</p>
                    <p className="text-sm text-slate-500">Marketing Director, Asian Street by Thai</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card className="bg-slate-900 border-slate-800">
              <CardContent className="p-6">
                <Quote className="w-8 h-8 text-slate-600 mb-4" />
                <p className="text-slate-300 mb-6">
                  "A brilliant student who consistently demonstrates exceptional problem-solving abilities and a deep understanding 
                  of complex data science concepts. His projects always exceed expectations."
                </p>
                <div className="flex items-center">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-r from-green-500 to-teal-500 flex items-center justify-center text-white font-bold mr-3">
                    PS
                  </div>
                  <div>
                    <p className="font-bold">Prof. Sarah Johnson</p>
                    <p className="text-sm text-slate-500">University of Wollongong in Dubai</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>
      
      {/* Call to Action */}
      <section className="py-20 bg-gradient-to-r from-blue-500/10 to-purple-500/10">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto text-center">
            <h2 className="text-4xl md:text-5xl font-bold mb-6 bg-gradient-to-r from-blue-500 to-purple-500 text-transparent bg-clip-text">
              Let's Create Something Amazing Together
            </h2>
            
            <p className="text-xl text-slate-300 mb-8">
              Whether you need data science expertise, marketing insights, or a unique combination of both, 
              I'm ready to help bring your vision to life.
            </p>
            
            <div className="flex flex-wrap gap-4 justify-center">
              <Link href="/projects">
                <Button className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-6 text-lg rounded-full">
                  View My Projects <ChevronRight size={20} className="ml-2" />
                </Button>
              </Link>
              
              <Link href="/contact">
                <Button variant="outline" className="border-purple-500 text-purple-400 hover:bg-purple-500/10 px-8 py-6 text-lg rounded-full">
                  Get In Touch <MessageSquare size={20} className="ml-2" />
                </Button>
              </Link>
              
              <Button 
                variant="outline" 
                className="border-green-500 text-green-400 hover:bg-green-500/10 px-8 py-6 text-lg rounded-full"
              >
                <Download size={20} className="mr-2" /> Download Resume
              </Button>
            </div>
            
            <div className="mt-12 flex justify-center items-center gap-6">
              <div className="flex items-center gap-2">
                <MapPin size={16} className="text-slate-400" />
                <span className="text-slate-400">Dubai, UAE</span>
              </div>
              <div className="w-1 h-1 bg-slate-600 rounded-full"></div>
              <div className="flex items-center gap-2">
                <Calendar size={16} className="text-slate-400" />
                <span className="text-slate-400">Available for Projects</span>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}